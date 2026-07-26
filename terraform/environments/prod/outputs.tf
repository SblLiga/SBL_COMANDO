output "rds_endpoint" {
  value = module.rds.db_instance_endpoint
}

output "rds_address" {
  value = module.rds.db_instance_address
}

output "db_secret_arn" {
  value = module.rds.db_secret_arn
}

output "eb_environment_name" {
  value = module.eb.environment_name
}

output "eb_cname" {
  value = module.eb.environment_endpoint
}

output "pipeline_name" {
  value = module.pipeline.pipeline_name
}

output "artifact_bucket_name" {
  value     = module.pipeline.artifact_bucket_name
  sensitive = true
}

output "github_actions_role_arn" {
  description = "Paste into GitHub secret AWS_ROLE_ARN_PROD"
  value       = module.github_oidc.role_arn
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "webhook_url_hint" {
  description = "Payment webhook once custom domain/HTTPS is live"
  value       = "https://<prod-host>/api/integrations/grow/webhook"
}
