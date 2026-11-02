output "state_bucket" {
  description = "Pass this to terraform init in infra/aws/live as -backend-config=bucket=<name>."
  value       = aws_s3_bucket.state.id
}
