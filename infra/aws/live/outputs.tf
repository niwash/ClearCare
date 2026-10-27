output "certificate_validation_records" {
  description = "CNAME records to add in Cloudflare, DNS only, so ACM can issue the certificate."
  value = {
    for option in aws_acm_certificate.public.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}

output "load_balancer_dns_name" {
  description = "Point both hostnames here with CNAME records in Cloudflare."
  value       = aws_lb.main.dns_name
}

output "ecr_repositories" {
  description = "Repository URL by image."
  value       = { for name, repository in aws_ecr_repository.image : name => repository.repository_url }
}

output "github_role_arns" {
  description = "The roles the AWS workflows assume."
  value = {
    build  = aws_iam_role.github_build.arn
    deploy = aws_iam_role.github_deploy.arn
  }
}

output "database_address" {
  description = "The database's private hostname."
  value       = aws_db_instance.main.address
}

output "database_secret_arns" {
  description = "The secrets that hold the database passwords. The values are not in Terraform."
  value = merge(
    { for name, secret in aws_secretsmanager_secret.database : name => secret.arn },
    { admin = local.admin_secret_arn },
  )
}

output "buckets" {
  description = "Bucket name by purpose."
  value       = { for purpose, bucket in aws_s3_bucket.bucket : purpose => bucket.id }
}
