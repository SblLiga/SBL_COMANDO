locals {
  base_env_vars = {
    # AWS native dynamic references (resolved by CloudFormation/Beanstalk)
    DB_HOST       = "{{resolve:ssm:${var.db_host_ssm_parameter}}}"
    DB_NAME       = "{{resolve:ssm:${var.db_name_ssm_parameter}}}"
    DB_USER       = "{{resolve:ssm:${var.db_user_ssm_parameter}}}"
    DB_SECRET_ARN = var.db_secret_arn
    DB_PORT       = "5432"
    DB_SSLMODE    = "require"
    APP_ENV       = "{{resolve:ssm:${var.app_env_ssm_parameter}}}"
    # Do NOT use {{resolve:secretsmanager:...ARN...}} — full ARNs contain colons and
    # break CloudFormation dynamic references. App reads password via DB_SECRET_ARN.
    DB_PASSWORD       = ""
    RUN_DB_MIGRATIONS = "true"
    AWS_REGION        = var.aws_region
    AWS_DEFAULT_REGION = var.aws_region
    JWT_SECRET        = var.jwt_secret
  }

  environment_variables = merge(local.base_env_vars, var.additional_environment_variables)
}

resource "aws_iam_role" "service" {
  name = "${var.environment_name}-eb-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "elasticbeanstalk.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(var.tags, { Name = "${var.environment_name}-eb-service-role" })
}

resource "aws_iam_role_policy_attachment" "service_managed" {
  role       = aws_iam_role.service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkService"
}

resource "aws_iam_role_policy_attachment" "service_enhanced_health" {
  role       = aws_iam_role.service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_role_policy" "service_read_db_secret" {
  name = "${var.environment_name}-eb-service-read-db-secret"
  role = aws_iam_role.service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.db_secret_arn
    }]
  })
}

locals {
  pipeline_artifact_s3_resources = var.pipeline_artifact_bucket_name != null ? [
    "arn:aws:s3:::${var.pipeline_artifact_bucket_name}",
    "arn:aws:s3:::${var.pipeline_artifact_bucket_name}/*"
  ] : []

  service_s3_deploy_resources = concat(
    [
      "arn:aws:s3:::elasticbeanstalk-platform-assets-${var.aws_region}",
      "arn:aws:s3:::elasticbeanstalk-platform-assets-${var.aws_region}/*",
      "arn:aws:s3:::elasticbeanstalk-${var.aws_region}-${var.aws_account_id}",
      "arn:aws:s3:::elasticbeanstalk-${var.aws_region}-${var.aws_account_id}/*"
    ],
    local.pipeline_artifact_s3_resources
  )
}

resource "aws_iam_role_policy" "service_s3_deploy" {
  name = "${var.environment_name}-eb-service-s3-deploy"
  role = aws_iam_role.service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = local.service_s3_deploy_resources
      }
    ]
  })
}

resource "aws_iam_role" "ec2" {
  name = "${var.environment_name}-eb-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "eb_web_tier" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role_policy_attachment" "eb_multicontainer_docker" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkMulticontainerDocker"
}

resource "aws_iam_role_policy" "eb_read_db_secret" {
  name = "${var.environment_name}-read-db-secret"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.db_secret_arn
    }]
  })
}

resource "aws_iam_role_policy" "eb_ses_send" {
  name = "${var.environment_name}-eb-ses-send"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.environment_name}-eb-ec2-profile"
  role = aws_iam_role.ec2.name

  tags = var.tags
}

resource "aws_elastic_beanstalk_application" "this" {
  name        = var.application_name
  description = var.description

  tags = merge(var.tags, { Name = var.application_name })
}

resource "aws_elastic_beanstalk_environment" "this" {
  name                = var.environment_name
  application         = aws_elastic_beanstalk_application.this.name
  solution_stack_name = var.solution_stack_name
  tier                = "WebServer"

  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = var.vpc_id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = join(",", var.instance_subnet_ids)
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "AssociatePublicIpAddress"
    value     = var.associate_public_ip_address ? "true" : "false"
  }

  dynamic "setting" {
    for_each = var.environment_type == "LoadBalanced" ? [1] : []
    content {
      namespace = "aws:ec2:vpc"
      name      = "ELBSubnets"
      value     = join(",", var.elb_subnet_ids)
    }
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.instance_type
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.ec2.name
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = var.security_group_id
  }

  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MinSize"
    value     = tostring(var.min_instances)
  }

  setting {
    namespace = "aws:autoscaling:asg"
    name      = "MaxSize"
    value     = tostring(var.max_instances)
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = var.environment_type
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.service.name
  }

  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application"
    name      = "Application Healthcheck URL"
    value     = "/health"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "HealthCheckPath"
    value     = "/health"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "MatcherHTTPCode"
    value     = "200"
  }

  dynamic "setting" {
    for_each = var.environment_type == "LoadBalanced" ? [1] : []
    content {
      namespace = "aws:elasticbeanstalk:environment"
      name      = "LoadBalancerType"
      value     = var.load_balancer_type
    }
  }

  dynamic "setting" {
    for_each = local.environment_variables
    content {
      namespace = "aws:elasticbeanstalk:application:environment"
      name      = setting.key
      value     = setting.value
    }
  }

  tags = merge(var.tags, { Name = var.environment_name })
}
