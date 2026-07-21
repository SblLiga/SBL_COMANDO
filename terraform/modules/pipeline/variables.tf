variable "name" {
  type = string
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "source_repo" {
  description = "GitHub owner/repo (monorepo)"
  type        = string
}

variable "source_branch" {
  description = "Pipeline source branch: dev → Dev env, main → Prod env"
  type        = string
}

variable "frontend_branch" {
  description = "Frontend git branch to clone in CodeBuild: staging (dev) or main (prod)"
  type        = string
}

variable "frontend_repo" {
  description = "GitHub owner/repo for frontend clone (may match monorepo or a separate frontend repo)"
  type        = string
}

variable "github_token_secret_arn" {
  description = "Optional Secrets Manager ARN (plain-text PAT) for private frontend clone"
  type        = string
  default     = null
}

variable "codestar_connection_arn" {
  type = string
}

variable "artifact_bucket_name" {
  type = string
}

variable "buildspec_path" {
  description = "Path to buildspec relative to repository root"
  type        = string
  default     = "backend/buildspec.yml"
}

variable "codebuild_compute_type" {
  type    = string
  default = "BUILD_GENERAL1_SMALL"
}

variable "codebuild_image" {
  description = "Prefer Amazon Linux 2 Graviton standard image when using ARM"
  type        = string
  default     = "aws/codebuild/amazonlinux2-aarch64-standard:3.0"
}

variable "codebuild_environment_type" {
  type    = string
  default = "ARM_CONTAINER"
}

variable "eb_application_name" {
  type = string
}

variable "eb_environment_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
