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
