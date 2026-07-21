locals {
  postgres_family = "postgres${split(".", var.engine_version)[0]}"
}

resource "random_password" "db_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.name}/db-credentials"
  description             = "PostgreSQL credentials for ${var.name}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = merge(var.tags, { Name = "${var.name}-db-credentials" })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    username = var.username
    password = coalesce(var.password, random_password.db_master.result)
    engine   = "postgres"
    dbname   = var.db_name
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  depends_on = [aws_secretsmanager_secret_version.db_credentials]
}

locals {
  db_credentials = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
  db_password    = local.db_credentials.password
}

resource "aws_db_parameter_group" "this" {
  name        = "${var.name}-pg"
  family      = local.postgres_family
  description = "PostgreSQL parameters for ${var.name}"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = merge(var.tags, { Name = "${var.name}-pg" })
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Name = "${var.name}-subnet-group" })
}

resource "aws_security_group" "db_sg" {
  name        = "${var.name}-db-sg"
  description = "PostgreSQL access for ${var.name}"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.allow_public_cidr ? [1] : []
    content {
      description = "PostgreSQL from anywhere (dev only)"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  dynamic "ingress" {
    for_each = var.allow_public_cidr ? [] : [1]
    content {
      description     = "PostgreSQL from Elastic Beanstalk"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [var.eb_security_group_id]
    }
  }

  dynamic "ingress" {
    for_each = var.allow_public_cidr ? [] : var.allowed_cidr_blocks
    content {
      description = "PostgreSQL from office / allowed IP"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-db-sg" })
}

resource "aws_db_instance" "this" {
  identifier     = var.name
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage > 0 ? var.max_allocated_storage : null

  db_name  = var.db_name
  username = var.username
  password = local.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  publicly_accessible    = var.publicly_accessible

  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_period
  storage_encrypted       = var.storage_encrypted
  skip_final_snapshot     = var.skip_final_snapshot

  tags = merge(var.tags, { Name = var.name })

  lifecycle {
    ignore_changes  = [password]
    prevent_destroy = true
  }
}
