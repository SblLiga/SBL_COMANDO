variable "name_prefix" {
  description = "Prefix for IAM role name (e.g. sbl-dev)"
  type        = string
}

variable "allowed_subs" {
  description = "Exact/StringLike OIDC sub claims allowed to assume the role (must not be fully wildcarded)"
  type        = list(string)
}

variable "pipeline_arn" {
  description = "CodePipeline ARN this role is allowed to start"
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the account-level GitHub OIDC provider (set false if it already exists)"
  type        = bool
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
