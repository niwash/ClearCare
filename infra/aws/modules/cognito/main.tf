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

  # Version 1 is the classic hosted UI, which ignores branding. Version 2 is the managed
  # login that takes a style per app client, so the two move together.
  managed_login_version = var.branding_enabled ? 2 : 1
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

# The style behind Cognito's managed login pages: sign in, sign up, confirm the address and reset
# the password, since they are all one set of screens.
#
# The settings document is the branding editor's own export, taken from a style Cognito created
# with its provided values and then edited to the design (assets/settings.json), so every value it
# does not mention is still Cognito's, not a guess.
#
# The artwork is a page background per colour mode. Managed login draws one form and no copy of its
# own, so the two-panel split, the gradient and the panel words are a picture the page is covered
# with; the form is set to the start of the page so it sits over the gradient half. The picture is
# static: re-render it from assets/page-background-<mode>.html when the words or colours change.
#
# The header logo is the site's wordmark over its motto, on the brand band. On a phone the page
# background is dropped, so that band is all a visitor sees above the form and the only thing that
# says whose sign-in page this is.
resource "aws_cognito_managed_login_branding" "web" {
  count = var.branding_enabled ? 1 : 0

  client_id    = aws_cognito_user_pool_client.web.id
  user_pool_id = aws_cognito_user_pool.this.id

  settings = file("${path.module}/assets/settings.json")

  dynamic "asset" {
    for_each = {
      background_light = { category = "PAGE_BACKGROUND", mode = "LIGHT", file = "page-background-light.png" }
      background_dark  = { category = "PAGE_BACKGROUND", mode = "DARK", file = "page-background-dark.png" }
      logo_light       = { category = "PAGE_HEADER_LOGO", mode = "LIGHT", file = "header-logo.png" }
      logo_dark        = { category = "PAGE_HEADER_LOGO", mode = "DARK", file = "header-logo.png" }
    }

    content {
      bytes      = filebase64("${path.module}/assets/${asset.value.file}")
      category   = asset.value.category
      color_mode = asset.value.mode
      extension  = "PNG"
    }
  }
}
