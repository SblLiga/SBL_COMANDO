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

variable "office_cidr_blocks" {
  description = "כתובות IP של המשרד המורשות לגישה ל-RDS (בנוסף ל-SG של Beanstalk)"
  type        = list(string)
  default     = []
}

variable "rds_name" {
  type    = string
  default = "sbl-prod-db"
}

variable "rds_instance_class" {
  description = "Prod RDS — Graviton t4g.small"
  type        = string
  default     = "db.t4g.small"
}

variable "rds_allocated_storage" {
  type    = number
  default = 50
}

variable "rds_max_allocated_storage" {
  type    = number
  default = 100
}

variable "rds_engine_version" {
  type    = string
  default = "15"
}

variable "rds_multi_az" {
  type    = bool
  default = true
}

variable "rds_backup_retention_period" {
  type    = number
  default = 30
}

variable "db_name" {
  type    = string
  default = "sbl_prod"
}

variable "db_username" {
  type    = string
  default = "sbl_admin"
}

variable "eb_application_name" {
  type    = string
  default = "sbl-prod-app"
}

variable "eb_environment_name" {
  type    = string
  default = "sbl-prod"
}

variable "eb_solution_stack_name" {
  description = "Deprecated. Kept for compatibility; value is now read from SSM."
  type = string
  default = null
}

variable "eb_instance_type" {
  type    = string
  default = "t4g.small"
}

variable "eb_min_instances" {
  type    = number
  default = 2
}

variable "eb_max_instances" {
  type    = number
  default = 4
}

variable "additional_eb_env_vars" {
  description = "Extra Beanstalk env vars. Any new key from local .env MUST be added here for cloud."
  type        = map(string)
  default     = {}
}

variable "pipeline_name" {
  type    = string
  default = "sbl-prod-pipeline"
}

variable "pipeline_source_repo" {
  description = "Deprecated. Value is now read from SSM."
  type = string
  default = null
}

variable "pipeline_source_branch" {
  type    = string
  default = "prod"
}

variable "pipeline_frontend_branch" {
  description = "Frontend branch pulled by CodeBuild (monorepo: same as source branch)"
  type        = string
  default     = "prod"
}

variable "github_token_secret_ssm_parameter" {
  description = "Optional SSM path whose value is a Secrets Manager ARN for a GitHub PAT (private frontend clone)"
  type        = string
  default     = null
}

variable "pipeline_artifact_bucket_name" {
  description = "Deprecated. Value is now read from SSM."
  type = string
  default = null
}

variable "codestar_connection_arn" {
  description = "Deprecated. Value is now read from SSM."
  type = string
  default = null
}

variable "ssm_config_prefix" {
  description = "SSM prefix for non-sensitive environment config"
  type        = string
  default     = "/sbl/prod"
}
