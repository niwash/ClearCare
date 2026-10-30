data "aws_region" "current" {}

resource "aws_cognito_user_pool" "this" {
  name           = var.pool_name
  user_pool_tier = "ESSENTIALS"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  mfa_configuration = "OFF"

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  # Sign-up has to work for older adults, so the policy asks for length and a number and nothing
  # else: no capitals to hunt for and no symbols that are awkward on a phone keyboard. Length is
  # what stops guessing, and 8 with a number is the floor rather than the target.
  # Passwords never expire, and the rules only apply when a password is set, so nobody has to
  # change an existing one.
  password_policy {
    minimum_length                   = 8
    require_lowercase                = false
    require_uppercase                = false
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  username_configuration {
    case_sensitive = false
  }

  # Cognito's own sender needs no setup and allows 50 emails a day, which is enough to try the pool
  # and not enough for the public. Sending through SES needs the verified identity's ARN and an
  # address on that identity; both are left out, so the new attributes stay unset.
  email_configuration {
    email_sending_account = var.ses_source_arn == "" ? "COGNITO_DEFAULT" : "DEVELOPER"
    source_arn            = var.ses_source_arn == "" ? null : var.ses_source_arn
    from_email_address    = var.from_email_address == "" ? null : var.from_email_address
  }

  deletion_protection = var.deletion_protection
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id

  # Version 1 is the classic hosted UI. The branded managed login is version 2,
  # which also needs a branding style per app client.
  managed_login_version = 1
}

resource "aws_cognito_user_pool_client" "web" {
  name            = "${var.pool_name}-web"
  user_pool_id    = aws_cognito_user_pool.this.id
  generate_secret = true

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
}
