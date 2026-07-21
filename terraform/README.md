# Terraform — SBL-ALLAPP

ניהול תשתית AWS לשתי סביבות נפרדות: **dev** ו-**prod**.

## מודולים

| מודול | תפקיד |
|--------|--------|
| `modules/rds` | RDS PostgreSQL, Parameter Group (`force_ssl`), Security Group, Secrets Manager |
| `modules/eb` | אפליקציית + סביבת Elastic Beanstalk, תפקידי IAM, הזרקת משתני DB |
| `modules/pipeline` | S3 artifacts, CodeBuild, CodePipeline V2, מדיניות Least Privilege |

## סביבות

```
environments/
├── dev/     # RDS db.t3.micro · EB t4g.micro · ענף dev
└── prod/    # RDS db.t4g.small · EB t4g.small · ענף main
```

כל סביבה היא root module עצמאי (state נפרד). אין remote backend מוגדר כברירת מחדל — הוסיפו `backend "s3"` לפי מדיניות הארגון.

## קונפיגורציה וסודות (AWS Native בלבד)

- אין שימוש ב-`secrets.auto.tfvars`.
- סודות רגישים מנוהלים ב-**AWS Secrets Manager**.
- קונפיגורציה לא רגישה מנוהלת ב-**SSM Parameter Store**.
- Terraform מושך ערכים דרך `data "aws_ssm_parameter"` ו-`data "aws_secretsmanager_secret_version"` בזמן `apply`.

נתיבי SSM נדרשים לכל סביבה:

- `/<prefix>/eb/solution_stack_name`
- `/<prefix>/pipeline/source_repo`
- `/<prefix>/pipeline/frontend_repo`
- `/<prefix>/pipeline/artifact_bucket_name`
- `/<prefix>/pipeline/codestar_connection_arn`
- `/<prefix>/app/app_env`
- `/<prefix>/app/log_level`

## Bootstrap חד-פעמי

לפני `terraform apply` הראשון, הריצו:

```powershell
cd scripts
.\bootstrap-dev.ps1
.\bootstrap-prod.ps1
```

מדריך מלא: [`scripts/BOOTSTRAP.md`](scripts/BOOTSTRAP.md)

## סדר פריסה מומלץ

1. Bootstrap — פרמטרי SSM (`scripts/bootstrap-*.ps1`)  
2. `environments/dev` — אימות מלא של Pipeline ו-EB  
3. הגדרת `office_cidr_blocks`  
4. `environments/prod`

## פקודות

```powershell
cd environments\dev   # או prod
terraform init
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```
