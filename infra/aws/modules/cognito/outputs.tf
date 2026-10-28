output "user_pool_id" {
  description = "User pool identifier."
  value       = aws_cognito_user_pool.this.id
}

output "issuer" {
  description = "OIDC issuer URL the web app validates against."
  value       = "https://${aws_cognito_user_pool.this.endpoint}"
}

output "domain" {
  description = "Managed login domain root, without a scheme-specific path."
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.region}.amazoncognito.com"
}

output "client_id" {
  description = "App client identifier."
  value       = aws_cognito_user_pool_client.web.id
}

output "client_secret" {
  description = "App client secret. Read it with terraform output, never commit it."
  value       = aws_cognito_user_pool_client.web.client_secret
  sensitive   = true
}

output "callback_urls" {
  description = "Callback URLs registered on the app client."
  value       = aws_cognito_user_pool_client.web.callback_urls
}
