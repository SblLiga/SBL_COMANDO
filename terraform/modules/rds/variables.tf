variable "name" {
  type = string
}

variable "environment" {
  description = "dev | prod — controls Secrets Manager recovery window"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "eb_security_group_id" {
  description = "Elastic Beanstalk instance security group (required when allow_public_cidr = false)"
  type        = string
  default     = null
}

variable "allow_public_cidr" {
  description = "When true (dev), allow 0.0.0.0/0 on port 5432. When false (prod), allow EB SG + allowed_cidr_blocks only."
  type        = bool
  default     = false
}

variable "allowed_cidr_blocks" {
  description = "Office / developer CIDRs allowed to reach PostgreSQL (prod)"
  type        = list(string)
  default     = []
}

variable "publicly_accessible" {
  description = "Expose RDS on a public subnet / public DNS"
  type        = bool
  default     = true
}

variable "instance_class" {
  description = "db.t3.micro (dev) or db.t4g.small (prod)"
  type        = string
}

variable "allocated_storage" {
  type = number
}

variable "max_allocated_storage" {
  type    = number
  default = 0
}

variable "engine_version" {
  type    = string
  default = "15"
}

variable "db_name" {
  type = string
}

variable "username" {
  type = string
}

variable "password" {
  description = "Optional master password. Omit to auto-generate."
  type        = string
  sensitive   = true
  default     = null
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "backup_retention_period" {
  type    = number
  default = 7
}

variable "skip_final_snapshot" {
  type    = bool
  default = true
}

variable "storage_encrypted" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
