# Migrate SBL app secrets into AWS Secrets Manager (values never go to git).
# Usage:
#   .\upsert-app-secrets.ps1 -Environment dev
#   .\upsert-app-secrets.ps1 -Environment prod -MailFrom "noreply@example.com" -AppPublicUrl "https://app.example.com"
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

if ($Environment -eq "dev") {
  $ebApp = "sbl-dev-app"
  $ebEnv = "sbl-dev"
} else {
  $ebApp = "sbl-prod-app"
  $ebEnv = "sbl-prod"
}

$secretName = "sbl-$Environment/app-secrets"
$roleName = "$ebEnv-eb-ec2-role"

Write-Host "=== SBL secrets to Secrets Manager ($Environment) ==="
Write-Host "Secret name: $secretName"
Write-Host "EB: $ebApp / $ebEnv"

$optsJson = aws elasticbeanstalk describe-configuration-settings --region $Region --application-name $ebApp --environment-name $ebEnv --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment']" --output json
$opts = $optsJson | ConvertFrom-Json

function Get-EbOpt([string]$name) {
  $hit = $opts | Where-Object { $_.OptionName -eq $name } | Select-Object -First 1
  if ($null -eq $hit) { return "" }
  return [string]$hit.Value
}

$existingJwt = Get-EbOpt "JWT_SECRET"
$existingAppArn = Get-EbOpt "APP_SECRET_ARN"

if ([string]::IsNullOrWhiteSpace($existingJwt) -and [string]::IsNullOrWhiteSpace($existingAppArn)) {
  Write-Host "WARN: No JWT_SECRET on EB - generating a new one."
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $existingJwt = [Convert]::ToBase64String($bytes)
}

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

$secretExists = $false
try {
  $ErrorActionPreference = "Continue"
  $describeOut = aws secretsmanager describe-secret --region $Region --secret-id $secretName --query ARN --output text 2>$null
  if ($LASTEXITCODE -eq 0 -and $describeOut -and $describeOut -ne "None") {
    $secretExists = $true
  }
} catch {
  $secretExists = $false
} finally {
  $ErrorActionPreference = "Stop"
}

if ($secretExists) {
  Write-Host "Merging into existing secret (preserving non-empty keys)..."
  $raw = aws secretsmanager get-secret-value --region $Region --secret-id $secretName --query SecretString --output text
  $prev = $raw | ConvertFrom-Json
  foreach ($p in $prev.PSObject.Properties) {
    $k = $p.Name
    $v = [string]$p.Value
    $cur = ""
    if ($payload.Contains($k)) { $cur = [string]$payload[$k] }
    if ($v -and [string]::IsNullOrEmpty($cur)) {
      $payload[$k] = $v
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($existingJwt)) {
    $payload["jwt_secret"] = $existingJwt
  }
} else {
  Write-Host "Creating secret $secretName ..."
  aws secretsmanager create-secret --region $Region --name $secretName --description "SBL app secrets" --secret-string "{}" | Out-Null
}

$json = ($payload | ConvertTo-Json -Compress)
$tmp = Join-Path $env:TEMP ("sbl-app-secret-" + [guid]::NewGuid().ToString() + ".json")
try {
  [System.IO.File]::WriteAllText($tmp, $json)
  aws secretsmanager put-secret-value --region $Region --secret-id $secretName --secret-string "file://$tmp" | Out-Null
} finally {
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
}

$secretArn = aws secretsmanager describe-secret --region $Region --secret-id $secretName --query ARN --output text
Write-Host "Secret ARN: $secretArn"

Write-Host "Updating IAM policy on $roleName ..."
$dbSecretPattern = "arn:aws:secretsmanager:${Region}:*:secret:sbl-$Environment-db/*"
$policyObj = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Effect   = "Allow"
      Action   = @("secretsmanager:GetSecretValue")
      Resource = @($secretArn, $dbSecretPattern)
    }
  )
}
$policyJson = ($policyObj | ConvertTo-Json -Depth 6 -Compress)
$policyTmp = Join-Path $env:TEMP ("sbl-app-iam-" + [guid]::NewGuid().ToString() + ".json")
try {
  [System.IO.File]::WriteAllText($policyTmp, $policyJson)
  aws iam put-role-policy --role-name $roleName --policy-name "$ebEnv-read-app-secrets" --policy-document "file://$policyTmp" | Out-Null
} finally {
  Remove-Item -Force $policyTmp -ErrorAction SilentlyContinue
}

Write-Host "Updating Elastic Beanstalk environment variables..."
aws elasticbeanstalk update-environment --region $Region --application-name $ebApp --environment-name $ebEnv --option-settings "Namespace=aws:elasticbeanstalk:application:environment,OptionName=APP_SECRET_ARN,Value=$secretArn" "Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value=" | Out-Null

Write-Host ""
Write-Host "DONE. Secrets are in AWS Secrets Manager - not in git, not in local .env."
Write-Host "Deploy the app code that reads APP_SECRET_ARN so JWT loads from SM."
Write-Host "Optional: .\upsert-app-secrets.ps1 -Environment $Environment -MailFrom 'noreply@domain' -AppPublicUrl 'https://...'"
