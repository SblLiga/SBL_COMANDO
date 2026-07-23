<#
.SYNOPSIS
  Migrate SBL app secrets into AWS Secrets Manager (never commits values to git).

.DESCRIPTION
  - Creates/updates secret: sbl/<env>/app-secrets
  - Migrates current EB JWT_SECRET into the secret (no console print of values)
  - Grants EB instance role GetSecretValue on the app secret
  - Sets EB env APP_SECRET_ARN and clears plaintext JWT_SECRET from EB

.EXAMPLE
  .\upsert-app-secrets.ps1 -Environment dev
  .\upsert-app-secrets.ps1 -Environment prod -MailFrom "noreply@example.com" -AppPublicUrl "https://app.example.com"
#>
param(
  [ValidateSet("dev", "prod")]
  [string]$Environment = "dev",
  [string]$Region = "us-east-1",
  [string]$MailFrom = "",
  [string]$AppPublicUrl = "",
  [string]$GrowWebhookSecret = "",
  [string]$AdminEmail = "",
  [string]$AdminPassword = ""
)

$ErrorActionPreference = "Stop"

$ebApp = if ($Environment -eq "dev") { "sbl-dev-app" } else { "sbl-prod-app" }
$ebEnv = if ($Environment -eq "dev") { "sbl-dev" } else { "sbl-prod" }
$secretName = "sbl/$Environment/app-secrets"
$roleName = "$ebEnv-eb-ec2-role"

Write-Host "=== SBL secrets → Secrets Manager ($Environment) ==="
Write-Host "Secret name: $secretName"
Write-Host "EB: $ebApp / $ebEnv"

# 1) Read current JWT from EB (do not print value)
$opts = aws elasticbeanstalk describe-configuration-settings `
  --region $Region `
  --application-name $ebApp `
  --environment-name $ebEnv `
  --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment']" `
  --output json | ConvertFrom-Json

function Get-EbOpt([string]$name) {
  ($opts | Where-Object { $_.OptionName -eq $name } | Select-Object -First 1).Value
}

$existingJwt = Get-EbOpt "JWT_SECRET"
$existingAppArn = Get-EbOpt "APP_SECRET_ARN"

if (-not $existingJwt -and -not $existingAppArn) {
  Write-Host "WARN: No JWT_SECRET on EB — generating a new one."
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $existingJwt = [Convert]::ToBase64String($bytes)
}

# 2) Merge with existing secret if present
$payload = [ordered]@{
  jwt_secret          = $existingJwt
  mail_from           = $MailFrom
  app_public_url      = $AppPublicUrl
  grow_webhook_secret = $GrowWebhookSecret
  grow_payment_url    = "https://grow.co.il/subscribe"
  admin_email         = $AdminEmail
  admin_password      = $AdminPassword
  dev_admin_password  = ""
}

$secretExists = $true
try {
  $currentArn = aws secretsmanager describe-secret --region $Region --secret-id $secretName --query ARN --output text 2>$null
  if (-not $currentArn) { $secretExists = $false }
} catch {
  $secretExists = $false
}

if ($secretExists) {
  Write-Host "Merging into existing secret (preserving non-empty keys)..."
  $raw = aws secretsmanager get-secret-value --region $Region --secret-id $secretName --query SecretString --output text
  $prev = $raw | ConvertFrom-Json
  foreach ($p in $prev.PSObject.Properties) {
    $k = $p.Name
    $v = [string]$p.Value
    if ($v -and (-not $payload.Contains($k) -or [string]::IsNullOrEmpty([string]$payload[$k]))) {
      $payload[$k] = $v
    }
  }
  # Prefer migrating live EB JWT if present
  if ($existingJwt) { $payload.jwt_secret = $existingJwt }
} else {
  Write-Host "Creating secret $secretName ..."
  aws secretsmanager create-secret `
    --region $Region `
    --name $secretName `
    --description "SBL $Environment app secrets (JWT, mail, GROW, admin)" `
    --secret-string "{}" | Out-Null
}

$tmp = New-TemporaryFile
try {
  ($payload | ConvertTo-Json -Compress) | Set-Content -Path $tmp.FullName -Encoding utf8NoBOM
  aws secretsmanager put-secret-value `
    --region $Region `
    --secret-id $secretName `
    --secret-string "file://$($tmp.FullName)" | Out-Null
} finally {
  Remove-Item -Force $tmp.FullName -ErrorAction SilentlyContinue
}

$secretArn = aws secretsmanager describe-secret --region $Region --secret-id $secretName --query ARN --output text
Write-Host "Secret ARN: $secretArn"

# 3) IAM: allow EB instance role to read app secret (+ keep DB secret access)
Write-Host "Updating IAM policy on $roleName ..."
$policyDoc = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Effect   = "Allow"
      Action   = @("secretsmanager:GetSecretValue")
      Resource = @($secretArn, "arn:aws:secretsmanager:${Region}:*:secret:sbl-$Environment-db/*")
    }
  )
} | ConvertTo-Json -Depth 6 -Compress

$policyTmp = New-TemporaryFile
try {
  $policyDoc | Set-Content -Path $policyTmp.FullName -Encoding utf8NoBOM
  aws iam put-role-policy `
    --role-name $roleName `
    --policy-name "$ebEnv-read-app-secrets" `
    --policy-document "file://$($policyTmp.FullName)" | Out-Null
} finally {
  Remove-Item -Force $policyTmp.FullName -ErrorAction SilentlyContinue
}

# 4) Point EB at Secrets Manager; clear plaintext JWT from environment
Write-Host "Updating Elastic Beanstalk environment variables..."
aws elasticbeanstalk update-environment `
  --region $Region `
  --application-name $ebApp `
  --environment-name $ebEnv `
  --option-settings `
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=APP_SECRET_ARN,Value=$secretArn" `
    "Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value=" `
  | Out-Null

Write-Host ""
Write-Host "DONE. Secrets are in AWS Secrets Manager — not in git, not in local .env."
Write-Host "After the next app deploy (code that reads APP_SECRET_ARN), JWT comes from SM only."
Write-Host "Optional later: set mail/GROW/admin with:"
Write-Host "  .\upsert-app-secrets.ps1 -Environment $Environment -MailFrom 'noreply@domain' -AppPublicUrl 'https://...'"
