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

  pool_name     = "clearcare-dev"
  domain_prefix = var.domain_prefix
  callback_urls = [
    "${var.web_origin}/api/auth/callback/cognito",
    "${var.web_origin}/api/auth/callback/cognito-signup",
  ]
  logout_urls = ["${var.web_origin}/"]
}
