output "application_name" {
  value = aws_elastic_beanstalk_application.this.name
}

output "environment_name" {
  value = aws_elastic_beanstalk_environment.this.name
}

output "environment_endpoint" {
  value = aws_elastic_beanstalk_environment.this.cname
}

output "service_role_arn" {
  value = aws_iam_role.service.arn
}

output "ec2_instance_profile_name" {
  value = aws_iam_instance_profile.ec2.name
}
