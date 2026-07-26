# Run once in PowerShell (creates Make webhook secret for PROD)
$ErrorActionPreference = "Stop"
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
$env:GROW_SECRET = $secret

python -c @"
import json, subprocess, os
secret = os.environ['GROW_SECRET']
raw = subprocess.check_output(
    ['aws','secretsmanager','get-secret-value','--secret-id','sbl-prod/app-secrets','--region','us-east-1','--query','SecretString','--output','text'],
    text=True,
)
d = json.loads(raw)
d['grow_webhook_secret'] = secret
d.setdefault('mail_from', 'noreply@sblliga.com')
d.setdefault('app_public_url', 'https://sblliga.com')
payload = json.dumps(d, separators=(',', ':'))
ver = subprocess.check_output(
    ['aws','secretsmanager','put-secret-value','--secret-id','sbl-prod/app-secrets','--region','us-east-1','--secret-string',payload,'--query','VersionId','--output','text'],
    text=True,
).strip()
print('Stored OK, version=', ver)
"@

aws elasticbeanstalk restart-app-server --environment-name sbl-prod --region us-east-1
Write-Host ""
Write-Host "=== העתיקי את זה למפתחת Make ===" -ForegroundColor Green
Write-Host "Shared secret (HMAC): $secret"
Write-Host "================================="
