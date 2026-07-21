output "pipeline_name" {
  value = aws_codepipeline.this.name
}

output "pipeline_arn" {
  value = aws_codepipeline.this.arn
}

output "codebuild_project_name" {
  value = aws_codebuild_project.this.name
}

output "artifact_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "codebuild_role_arn" {
  value = aws_iam_role.codebuild.arn
}

output "pipeline_role_arn" {
  value = aws_iam_role.pipeline.arn
}
