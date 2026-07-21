#Requires -Version 5.1
<#
.SYNOPSIS
  Bootstrap חד-פעמי — פרמטרי SSM לסביבת Prod (לפני terraform apply).

.DESCRIPTION
  יוצר את כל פרמטרי SSM הנדרשים תחת /sbl/prod.
  Secrets Manager ל-RDS נוצר אוטומטית ע"י Terraform — אין צורך להריץ כאן.

.EXAMPLE
  cd terraform\scripts
  .\bootstrap-prod.ps1
#>

$ErrorActionPreference = "Stop"

# =============================================================================
# ערכים להתאמה — ערכו לפני הרצה
# =============================================================================
$Region              = "eu-north-1"
$ConfigPrefix        = "/sbl/prod"
$GitHubRepo          = "SblLiga/SBL_COMANDO"
$CodeStarArn         = ""   # השאירו ריק לגילוי אוטומטי
$EbSolutionStack     = ""   # השאירו ריק לבחירת AL2023 Docker האחרון
$ArtifactBucketName  = ""   # השאירו ריק ל-sbl-prod-pipeline-artifacts-<ACCOUNT_ID>
$AppEnv              = "prod"
$LogLevel            = "INFO"
# =============================================================================

Write-Host "=== SBL Bootstrap — PROD ===" -ForegroundColor Cyan

$AccountId = aws sts get-caller-identity --query Account --output text
if (-not $AccountId) { throw "AWS CLI לא מחובר. הריצו: aws configure" }
Write-Host "Account: $AccountId | Region: $Region"

if (-not $ArtifactBucketName) {
  $ArtifactBucketName = "sbl-prod-pipeline-artifacts-$AccountId"
}

if (-not $CodeStarArn) {
  $connections = aws codestar-connections list-connections --region $Region `
    --query "Connections[?ConnectionStatus=='AVAILABLE']" --output json | ConvertFrom-Json
  if (-not $connections -or $connections.Count -eq 0) {
    throw "לא נמצא CodeStar Connection במצב Available. צרו חיבור בקונסול AWS."
  }
  $CodeStarArn = $connections[0].ConnectionArn
  Write-Host "CodeStar (auto): $CodeStarArn" -ForegroundColor Yellow
}

if (-not $EbSolutionStack) {
  $stacks = aws elasticbeanstalk list-available-solution-stacks --region $Region --output json |
    ConvertFrom-Json
  $EbSolutionStack = ($stacks.SolutionStacks | Where-Object {
    $_ -match "Amazon Linux 2023" -and $_ -match "Docker"
  } | Select-Object -First 1)
  if (-not $EbSolutionStack) {
    throw "לא נמצא solution stack של AL2023 Docker. הגדירו EbSolutionStack ידנית."
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

Write-Host "`nCreating SSM parameters under $ConfigPrefix ..." -ForegroundColor Green

Put-SsmParameter -Name "$ConfigPrefix/eb/solution_stack_name" `
  -Value $EbSolutionStack `
  -Description "Elastic Beanstalk Docker solution stack (prod)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/source_repo" `
  -Value $GitHubRepo `
  -Description "GitHub monorepo for CodePipeline source (prod)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/frontend_repo" `
  -Value $GitHubRepo `
  -Description "GitHub repo cloned for frontend (prod). Same monorepo or separate frontend repo."

Put-SsmParameter -Name "$ConfigPrefix/pipeline/artifact_bucket_name" `
  -Value $ArtifactBucketName `
  -Description "S3 artifact bucket name for CodePipeline (prod)"

Put-SsmParameter -Name "$ConfigPrefix/pipeline/codestar_connection_arn" `
  -Value $CodeStarArn `
  -Description "CodeStar connection ARN for GitHub (prod)"

Put-SsmParameter -Name "$ConfigPrefix/app/app_env" `
  -Value $AppEnv `
  -Description "Application environment label (prod)"

Put-SsmParameter -Name "$ConfigPrefix/app/log_level" `
  -Value $LogLevel `
  -Description "Application log level (prod)"

Write-Host "`nVerifying parameters ..." -ForegroundColor Green
aws ssm get-parameters-by-path --region $Region --path $ConfigPrefix --recursive --output table

Write-Host "`n=== PROD bootstrap complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd ..\environments\prod"
Write-Host "  terraform init"
Write-Host "  terraform plan"
Write-Host "  terraform apply"
Write-Host ""
Write-Host "Secrets Manager (sbl-prod-db/db-credentials) will be created automatically by Terraform."
Write-Host "Ensure office_cidr_blocks is configured in prod variables before apply."
Write-Host "See BOOTSTRAP.md for verification commands."
