variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "project_name" {
  type    = string
  default = "sbl"
}

variable "common_tags" {
  type = map(string)
  default = {
    Project   = "SBL"
    ManagedBy = "Terraform"
  }
}

variable "rds_name" {
  type    = string
  default = "sbl-dev-db"
}

variable "rds_instance_class" {
  description = "Dev RDS — x86 t3.micro per guidelines"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  type    = number
  default = 20
}

variable "rds_engine_version" {
  type    = string
  default = "15"
}

variable "db_name" {
  type    = string
  default = "sbl_dev"
}

variable "db_username" {
  type    = string
  default = "sbl_admin"
}

variable "eb_application_name" {
  type    = string
  default = "sbl-dev-app"
}

variable "eb_environment_name" {
  type    = string
  default = "sbl-dev"
}

variable "eb_solution_stack_name" {
  description = "Deprecated. Kept for compatibility; value is now read from SSM."
  type        = string
  default     = null
}

variable "eb_instance_type" {
  description = "Prefer Graviton for compute"
  type        = string
  default     = "t4g.micro"
}

variable "additional_eb_env_vars" {
  description = "Extra Beanstalk env vars. Any new key from local .env MUST be added here for cloud."
  type        = map(string)
  default     = {}
}

variable "pipeline_name" {
  type    = string
  default = "sbl-dev-pipeline"
}

variable "pipeline_source_repo" {
  description = "Deprecated. Value is now read from SSM."
  type        = string
  default     = null
}

variable "pipeline_source_branch" {
  type    = string
  default = "dev"
}

variable "pipeline_frontend_branch" {
  description = "Frontend branch pulled by CodeBuild (monorepo: same as source branch)"
  type        = string
  default     = "dev"
}

variable "github_token_secret_ssm_parameter" {
  description = "Optional SSM path whose value is a Secrets Manager ARN for a GitHub PAT (private frontend clone)"
  type        = string
  default     = null
}

variable "pipeline_artifact_bucket_name" {
  description = "Deprecated. Value is now read from SSM."
  type        = string
  default     = null
}

variable "codestar_connection_arn" {
  description = "Deprecated. Value is now read from SSM."
  type        = string
  default     = null
}

variable "ssm_config_prefix" {
  description = "SSM prefix for non-sensitive environment config"
  type        = string
  default     = "/sbl/dev"
}
