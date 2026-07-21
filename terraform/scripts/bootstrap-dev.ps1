#Requires -Version 5.1
<#
.SYNOPSIS
  One-time bootstrap - SSM parameters for Dev (before terraform apply).

.DESCRIPTION
  Creates all required SSM parameters under /sbl/dev.
  RDS Secrets Manager is created automatically by Terraform.

.EXAMPLE
  cd terraform\scripts
  .\bootstrap-dev.ps1
#>

$ErrorActionPreference = "Stop"

# =============================================================================
# Values to customize - edit before running if needed
# =============================================================================
$Region              = "us-east-1"
$ConfigPrefix        = "/sbl/dev"
$GitHubRepo          = "SblLiga/SBL_COMANDO"
$CodeStarArn         = ""
$EbSolutionStack     = ""
$ArtifactBucketName  = ""
$AppEnv              = "dev"
$LogLevel            = "DEBUG"
# =============================================================================

Write-Host "=== SBL Bootstrap - DEV ===" -ForegroundColor Cyan

$AccountId = aws sts get-caller-identity --query Account --output text
if (-not $AccountId) { throw "AWS CLI not connected. Run: aws configure" }
Write-Host "Account: $AccountId | Region: $Region"

if (-not $ArtifactBucketName) {
  $ArtifactBucketName = "sbl-dev-pipeline-artifacts-$AccountId"
}

if (-not $CodeStarArn) {
  $connections = aws codestar-connections list-connections --region $Region `
    --query "Connections[?ConnectionStatus=='AVAILABLE']" --output json | ConvertFrom-Json
  if (-not $connections -or $connections.Count -eq 0) {
    throw "No Available CodeStar Connection found. Create one in AWS Console."
  }
  if ($connections -is [System.Array]) {
    $CodeStarArn = $connections[0].ConnectionArn
  } else {
    $CodeStarArn = $connections.ConnectionArn
  }
  Write-Host "CodeStar (auto): $CodeStarArn" -ForegroundColor Yellow
}

if (-not $EbSolutionStack) {
  $stacks = aws elasticbeanstalk list-available-solution-stacks --region $Region --output json |
    ConvertFrom-Json
  $EbSolutionStack = ($stacks.SolutionStacks | Where-Object {
    $_ -match "Amazon Linux 2023" -and $_ -match "Docker"
  } | Select-Object -First 1)
  if (-not $EbSolutionStack) {
    throw "No AL2023 Docker solution stack found. Set EbSolutionStack manually."
  }
  Write-Host "EB Stack (auto): $EbSolutionStack" -ForegroundColor Yellow
}

function Put-SsmParameter {
  param(
    [string]$Name,
    [string]$Value,
    [string]$Description
  )
  Write-Host "  + $Name"
  aws ssm put-parameter `
    --region $Region `
    --name $Name `
    --type "String" `
    --value $Value `
    --overwrite `
    --description $Description | Out-Null
}

Write-Host ""
Write-Host "Creating SSM parameters under $ConfigPrefix ..." -ForegroundColor Green

Put-SsmParameter -Name "$ConfigPrefix/eb/solution_stack_name" `
  -Value $EbSolutionStack `
  -Description "Elastic Beanstalk Docker solution stack (dev)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/source_repo" `
  -Value $GitHubRepo `
  -Description "GitHub monorepo for CodePipeline source (dev)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/frontend_repo" `
  -Value $GitHubRepo `
  -Description "GitHub repo cloned for frontend (dev)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/artifact_bucket_name" `
  -Value $ArtifactBucketName `
  -Description "S3 artifact bucket name for CodePipeline (dev)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/codestar_connection_arn" `
  -Value $CodeStarArn `
  -Description "CodeStar connection ARN for GitHub (dev)"

Put-SsmParameter -Name "$ConfigPrefix/app/app_env" `
  -Value $AppEnv `
  -Description "Application environment label (dev)"

Put-SsmParameter -Name "$ConfigPrefix/app/log_level" `
  -Value $LogLevel `
  -Description "Application log level (dev)"

Write-Host ""
Write-Host "Verifying parameters ..." -ForegroundColor Green
aws ssm get-parameters-by-path --region $Region --path $ConfigPrefix --recursive --output table

Write-Host ""
Write-Host "=== DEV bootstrap complete ===" -ForegroundColor Cyan
Write-Host "Next: cd ..\environments\dev ; terraform init ; terraform plan ; terraform apply"
