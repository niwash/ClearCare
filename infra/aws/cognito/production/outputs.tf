output "user_pool_id" {
  description = "Pool identifier, for admin commands such as deleting an account."
  value       = module.cognito.user_pool_id
}

output "issuer" {
  description = "Value for AUTH_COGNITO_ISSUER."
  value       = module.cognito.issuer
}

output "domain" {
  description = "Value for COGNITO_DOMAIN."
  value       = module.cognito.domain
}

output "client_id" {
  description = "Value for AUTH_COGNITO_ID."
  value       = module.cognito.client_id
}

output "client_secret" {
  description = "Value for AUTH_COGNITO_SECRET. Never commit it."
  value       = module.cognito.client_secret
  sensitive   = true
}

output "callback_urls" {
  description = "Callback URLs registered with Cognito."
  value       = module.cognito.callback_urls
}

output "ses_dkim_tokens" {
  description = "CNAME records to publish for the sending domain, so SES can sign its mail."
  value       = aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens
}
