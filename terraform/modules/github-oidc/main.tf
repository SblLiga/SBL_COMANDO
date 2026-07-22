# Account-level OIDC provider for GitHub Actions (shared across environments).
# Create once per AWS account; other envs can set create_oidc_provider=false.

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = merge(var.tags, { Name = "${var.name_prefix}-github-oidc" })
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

resource "aws_iam_role" "github_actions" {
  name = "${var.name_prefix}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = local.oidc_provider_arn
        }
        Action = [
          "sts:AssumeRoleWithWebIdentity",
          "sts:TagSession",
        ]
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          # AWS requires a non-wildcard sub / job_workflow_ref constraint.
          # GitHub may emit numeric-id subjects: repo:Org@id/Repo@id:ref:...
          StringLike = {
            "token.actions.githubusercontent.com:sub" = var.allowed_subs
          }
        }
      }
    ]
  })

  tags = merge(var.tags, { Name = "${var.name_prefix}-github-actions" })
}

resource "aws_iam_role_policy" "start_pipeline" {
  name = "${var.name_prefix}-github-actions-start-pipeline"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StartAndReadPipeline"
        Effect = "Allow"
        Action = [
          "codepipeline:StartPipelineExecution",
          "codepipeline:GetPipeline",
          "codepipeline:GetPipelineState",
          "codepipeline:GetPipelineExecution",
          "codepipeline:ListPipelineExecutions",
        ]
        Resource = [
          var.pipeline_arn,
          "${var.pipeline_arn}/*",
        ]
      }
    ]
  })
}
