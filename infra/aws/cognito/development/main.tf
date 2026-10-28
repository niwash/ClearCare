provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project     = "clearcare"
      managed_by  = "terraform"
      jira        = "CCARE-161"
      environment = "development"
    }
  }
}

module "cognito" {
  source = "../../modules/cognito"

  pool_name     = "clearcare-dev"
  domain_prefix = var.domain_prefix
  callback_urls = ["${var.web_origin}/api/auth/callback/cognito"]
  logout_urls   = ["${var.web_origin}/"]

  tags = {
    purpose = "cognito-development"
  }
}
