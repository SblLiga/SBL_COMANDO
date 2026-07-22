variable "application_name" {
  type = string
}

variable "environment_name" {
  type = string
}

variable "description" {
  type    = string
  default = "SBL full-stack application"
}

variable "solution_stack_name" {
  type = string
}

variable "instance_type" {
  description = "Prefer Graviton: t4g.micro (dev) / t4g.small (prod)"
  type        = string
}

variable "environment_type" {
  description = "SingleInstance for Dev, LoadBalanced for Prod"
  type        = string
  default     = "SingleInstance"

  validation {
    condition     = contains(["SingleInstance", "LoadBalanced"], var.environment_type)
    error_message = "environment_type must be SingleInstance or LoadBalanced."
  }
}

variable "app_env_ssm_parameter" {
  description = "SSM parameter name/path for APP_ENV"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "instance_subnet_ids" {
  type = list(string)
}

variable "elb_subnet_ids" {
  type    = list(string)
  default = []
}

variable "associate_public_ip_address" {
  type    = bool
  default = true
}

variable "min_instances" {
  type    = number
  default = 1
}

variable "max_instances" {
  type    = number
  default = 1
}

variable "load_balancer_type" {
  type    = string
  default = "application"
}

variable "db_secret_arn" {
  type = string
}

variable "db_credentials_secret_id" {
  description = "Secrets Manager secret id or ARN containing password in SecretString"
  type        = string
}

variable "db_host_ssm_parameter" {
  type = string
}

variable "db_name_ssm_parameter" {
  type = string
}

variable "db_user_ssm_parameter" {
  type = string
}

variable "additional_environment_variables" {
  type    = map(string)
  default = {}
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "pipeline_artifact_bucket_name" {
  type    = string
  default = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "jwt_secret" {
  description = "JWT signing secret for auth tokens"
  type        = string
  sensitive   = true
}
