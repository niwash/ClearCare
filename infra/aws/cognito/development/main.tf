provider "aws" {
  region = var.aws_region

  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "clearcare"
      env     = "dev"
    }
  }
}

module "cognito" {
  source = "../../modules/cognito"

  pool_name = "clearcare-dev"

  # The ClearCare style on Cognito's own sign-in, sign-up and reset screens.
  branding_enabled = true
  domain_prefix    = var.domain_prefix
  callback_urls = [
    "${var.web_origin}/api/auth/callback/cognito",
    "${var.web_origin}/api/auth/callback/cognito-signup",
  ]
  logout_urls = ["${var.web_origin}/"]
}
