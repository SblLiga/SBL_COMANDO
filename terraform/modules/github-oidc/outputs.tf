output "oidc_provider_arn" {
  value = local.oidc_provider_arn
}

output "role_name" {
  value = aws_iam_role.github_actions.name
}

output "role_arn" {
  description = "Set this as GitHub secret AWS_ROLE_ARN_DEV (or PROD)"
  value       = aws_iam_role.github_actions.arn
}
