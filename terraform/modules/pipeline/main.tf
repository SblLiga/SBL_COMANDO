data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  build_project_name = "${var.name}-build"
  account_id         = data.aws_caller_identity.current.account_id
  region             = data.aws_region.current.name

  eb_application_arn = "arn:aws:elasticbeanstalk:${local.region}:${local.account_id}:application/${var.eb_application_name}"
  eb_environment_arn = "arn:aws:elasticbeanstalk:${local.region}:${local.account_id}:environment/${var.eb_application_name}/${var.eb_environment_name}"
  eb_version_arn     = "arn:aws:elasticbeanstalk:${local.region}:${local.account_id}:applicationversion/${var.eb_application_name}/*"

  eb_platform_assets_bucket = "arn:aws:s3:::elasticbeanstalk-platform-assets-${local.region}"
  eb_managed_bucket_root    = "arn:aws:s3:::elasticbeanstalk-${local.region}-${local.account_id}"
  eb_managed_bucket         = "${local.eb_managed_bucket_root}/*"

  eb_deploy_s3_resources = [
    local.eb_platform_assets_bucket,
    "${local.eb_platform_assets_bucket}/*",
    local.eb_managed_bucket_root,
    "${local.eb_managed_bucket_root}/*"
  ]
}

resource "aws_s3_bucket" "artifacts" {
  bucket = var.artifact_bucket_name
  tags   = merge(var.tags, { Name = var.artifact_bucket_name })
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# CodeBuild — least privilege
# -----------------------------------------------------------------------------
resource "aws_iam_role" "codebuild" {
  name = "${var.name}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codebuild.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "codebuild" {
  name = "${var.name}-codebuild-policy"
  role = aws_iam_role.codebuild.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/codebuild/${local.build_project_name}*"
      },
      {
        Sid    = "ArtifactBucket"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Sid    = "EbReadForEnvSync"
        Effect = "Allow"
        Action = [
          "elasticbeanstalk:DescribeConfigurationSettings",
          "elasticbeanstalk:DescribeEnvironments",
          "elasticbeanstalk:DescribeApplicationVersions"
        ]
        Resource = [
          local.eb_application_arn,
          local.eb_environment_arn,
          local.eb_version_arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "codebuild_github_token" {
  count = var.github_token_secret_arn != null ? 1 : 0

  name = "${var.name}-codebuild-github-token"
  role = aws_iam_role.codebuild.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.github_token_secret_arn
    }]
  })
}

resource "aws_codebuild_project" "this" {
  name         = local.build_project_name
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    # Prefer Graviton when available for the selected image.
    compute_type                = var.codebuild_compute_type
    image                       = var.codebuild_image
    type                        = var.codebuild_environment_type
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "APP_ENV"
      value = var.environment
    }

    environment_variable {
      name  = "DEPLOY_ENV"
      value = var.environment
    }

    environment_variable {
      name  = "SOURCE_BRANCH"
      value = var.source_branch
    }

    # Per company guide: CodeBuild pulls frontend by branch from DEPLOY_ENV mapping
    # (dev → staging, prod → main). FRONTEND_BRANCH is set explicitly by Terraform.
    environment_variable {
      name  = "FRONTEND_BRANCH"
      value = var.frontend_branch
    }

    environment_variable {
      name  = "FRONTEND_REPO"
      value = var.frontend_repo
    }

    environment_variable {
      name  = "EB_APPLICATION_NAME"
      value = var.eb_application_name
    }

    environment_variable {
      name  = "EB_ENVIRONMENT_NAME"
      value = var.eb_environment_name
    }

    environment_variable {
      name  = "AWS_REGION"
      value = local.region
    }

    dynamic "environment_variable" {
      for_each = var.github_token_secret_arn != null ? [1] : []
      content {
        name      = "GITHUB_TOKEN"
        type      = "SECRETS_MANAGER"
        value     = var.github_token_secret_arn
      }
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = var.buildspec_path
  }

  tags = merge(var.tags, { Name = local.build_project_name })
}

# -----------------------------------------------------------------------------
# CodePipeline — least privilege
# -----------------------------------------------------------------------------
resource "aws_iam_role" "pipeline" {
  name = "${var.name}-pipeline-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "codepipeline.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "pipeline" {
  name = "${var.name}-pipeline-policy"
  role = aws_iam_role.pipeline.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ArtifactBucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketVersioning"]
        Resource = [aws_s3_bucket.artifacts.arn]
      },
      {
        Sid    = "ArtifactBucketObjects"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:PutObject"]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Sid      = "CodeStarConnection"
        Effect   = "Allow"
        Action   = ["codestar-connections:UseConnection"]
        Resource = var.codestar_connection_arn
      },
      {
        Sid      = "CodeBuildStart"
        Effect   = "Allow"
        Action   = ["codebuild:BatchGetBuilds", "codebuild:StartBuild"]
        Resource = aws_codebuild_project.this.arn
      },
      {
        Sid    = "ElasticBeanstalkDeploy"
        Effect = "Allow"
        Action = [
          "elasticbeanstalk:CreateApplicationVersion",
          "elasticbeanstalk:UpdateEnvironment",
          "elasticbeanstalk:DescribeApplications",
          "elasticbeanstalk:DescribeApplicationVersions",
          "elasticbeanstalk:DescribeEnvironments",
          "elasticbeanstalk:DescribeEvents"
        ]
        Resource = [
          local.eb_application_arn,
          local.eb_environment_arn,
          local.eb_version_arn,
          "*"
        ]
      },
      {
        Sid    = "EbSupportingServices"
        Effect = "Allow"
        Action = [
          "ec2:Describe*",
          "autoscaling:Describe*",
          "autoscaling:SuspendProcesses",
          "autoscaling:ResumeProcesses",
          "autoscaling:UpdateAutoScalingGroup",
          "cloudformation:*",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:PutObject"
        ]
        Resource = "*"
      },
      {
        Sid    = "EbManagedBuckets"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          local.eb_managed_bucket_root,
          local.eb_managed_bucket
        ]
      },
      {
        Sid    = "EbPlatformAssets"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket"]
        Resource = local.eb_deploy_s3_resources
      }
    ]
  })
}

resource "aws_codepipeline" "this" {
  name          = var.name
  role_arn      = aws_iam_role.pipeline.arn
  pipeline_type = "V2"

  artifact_store {
    location = aws_s3_bucket.artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = var.codestar_connection_arn
        FullRepositoryId = var.source_repo
        BranchName       = var.source_branch
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.this.name
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ElasticBeanstalk"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName = var.eb_application_name
        EnvironmentName = var.eb_environment_name
      }
    }
  }

  tags = merge(var.tags, { Name = var.name })

  # No native CodeStar push trigger — per company guide, GitHub Actions starts
  # the pipeline on push to the environment branch (dev → Dev, main → Prod).
}
