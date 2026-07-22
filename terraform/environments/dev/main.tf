# Dev environment — Default VPC · public RDS · SingleInstance EB · branch: dev
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  # t4g (Graviton) is not available in every AZ (e.g. us-east-1e)
  filter {
    name   = "availability-zone"
    values = ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d", "us-east-1f"]
  }
}

locals {
  environment   = "dev"
  tags          = merge(var.common_tags, { Environment = local.environment })
  vpc_id        = data.aws_vpc.default.id
  subnet_ids    = data.aws_subnets.default.ids
  config_prefix = var.ssm_config_prefix
}

data "aws_ssm_parameter" "eb_solution_stack_name" {
  name = "${local.config_prefix}/eb/solution_stack_name"
}

data "aws_ssm_parameter" "pipeline_source_repo" {
  name = "${local.config_prefix}/pipeline/source_repo"
}

data "aws_ssm_parameter" "pipeline_artifact_bucket_name" {
  name = "${local.config_prefix}/pipeline/artifact_bucket_name"
}

data "aws_ssm_parameter" "codestar_connection_arn" {
  name = "${local.config_prefix}/pipeline/codestar_connection_arn"
}

data "aws_ssm_parameter" "app_env" {
  name = "${local.config_prefix}/app/app_env"
}

data "aws_ssm_parameter" "log_level" {
  name = "${local.config_prefix}/app/log_level"
}

data "aws_ssm_parameter" "frontend_repo" {
  name = "${local.config_prefix}/pipeline/frontend_repo"
}

data "aws_ssm_parameter" "github_token_secret_arn" {
  count = var.github_token_secret_ssm_parameter != null ? 1 : 0
  name  = var.github_token_secret_ssm_parameter
}

resource "aws_security_group" "beanstalk" {
  name        = "${var.eb_environment_name}-sg"
  description = "Elastic Beanstalk instances (dev)"
  vpc_id      = local.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${var.eb_environment_name}-sg" })
}

module "rds" {
  source = "../../modules/rds"

  name                 = var.rds_name
  environment          = local.environment
  vpc_id               = local.vpc_id
  subnet_ids           = local.subnet_ids
  eb_security_group_id = aws_security_group.beanstalk.id
  allow_public_cidr    = true
  publicly_accessible  = true

  instance_class      = var.rds_instance_class # db.t3.micro
  allocated_storage   = var.rds_allocated_storage
  engine_version      = var.rds_engine_version
  db_name             = var.db_name
  username            = var.db_username
  password            = null
  multi_az            = false
  skip_final_snapshot = true

  tags = local.tags
}

resource "aws_ssm_parameter" "db_host" {
  name  = "${local.config_prefix}/db/host"
  type  = "String"
  value = module.rds.db_instance_address
  tags  = local.tags
}

resource "aws_ssm_parameter" "db_name" {
  name  = "${local.config_prefix}/db/name"
  type  = "String"
  value = var.db_name
  tags  = local.tags
}

resource "aws_ssm_parameter" "db_user" {
  name  = "${local.config_prefix}/db/user"
  type  = "String"
  value = var.db_username
  tags  = local.tags
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = true
}

module "eb" {
  source = "../../modules/eb"

  application_name      = var.eb_application_name
  environment_name      = var.eb_environment_name
  solution_stack_name   = data.aws_ssm_parameter.eb_solution_stack_name.value
  instance_type         = var.eb_instance_type # t4g.micro
  environment_type      = "SingleInstance"
  app_env_ssm_parameter = data.aws_ssm_parameter.app_env.name

  aws_region     = var.aws_region
  aws_account_id = data.aws_caller_identity.current.account_id

  pipeline_artifact_bucket_name = data.aws_ssm_parameter.pipeline_artifact_bucket_name.value

  vpc_id                      = local.vpc_id
  security_group_id           = aws_security_group.beanstalk.id
  instance_subnet_ids         = local.subnet_ids
  associate_public_ip_address = true

  min_instances = 1
  max_instances = 1

  db_host_ssm_parameter    = aws_ssm_parameter.db_host.name
  db_name_ssm_parameter    = aws_ssm_parameter.db_name.name
  db_user_ssm_parameter    = aws_ssm_parameter.db_user.name
  db_secret_arn            = module.rds.db_secret_arn
  db_credentials_secret_id = module.rds.db_secret_name
  jwt_secret               = random_password.jwt_secret.result

  additional_environment_variables = merge(
    var.additional_eb_env_vars,
    { LOG_LEVEL = "{{resolve:ssm:${data.aws_ssm_parameter.log_level.name}}}" }
  )

  tags = local.tags

  depends_on = [module.rds]
}

module "pipeline" {
  source = "../../modules/pipeline"

  name          = var.pipeline_name
  environment   = local.environment
  source_repo   = data.aws_ssm_parameter.pipeline_source_repo.value
  source_branch = var.pipeline_source_branch # dev
  # Company guide: Dev CodeBuild pulls frontend from the same monorepo branch
  frontend_branch         = var.pipeline_frontend_branch
  frontend_repo           = data.aws_ssm_parameter.frontend_repo.value
  github_token_secret_arn = null
  codestar_connection_arn = data.aws_ssm_parameter.codestar_connection_arn.value
  artifact_bucket_name    = data.aws_ssm_parameter.pipeline_artifact_bucket_name.value
  buildspec_path          = "backend/buildspec.yml"
  eb_application_name     = module.eb.application_name
  eb_environment_name     = module.eb.environment_name

  tags = local.tags

  depends_on = [module.eb]
}
