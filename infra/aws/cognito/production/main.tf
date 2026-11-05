provider "aws" {
  region = var.aws_region

  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "clearcare"
      env     = "prod"
    }
  }
}

# Cognito's own sender is capped at 50 emails a day, so sign-up verification and password resets go
# through SES in production. The identity is verified by DNS records the operator publishes; until
# SES moves the account out of its sandbox, it only delivers to verified addresses.
resource "aws_sesv2_email_identity" "mail" {
  email_identity = var.ses_domain
}

data "aws_iam_policy_document" "cognito_send" {
  statement {
    sid       = "LetCognitoSendAccountMail"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.mail.arn]

    principals {
      type        = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }
  }
}

resource "aws_sesv2_email_identity_policy" "cognito_send" {
  email_identity = aws_sesv2_email_identity.mail.email_identity
  policy_name    = "cognito-send"
  policy         = data.aws_iam_policy_document.cognito_send.json
}

module "cognito" {
  source = "../../modules/cognito"

  pool_name     = "clearcare-prod"
  domain_prefix = var.domain_prefix
  callback_urls = [
    "${var.web_origin}/api/auth/callback/cognito",
    "${var.web_origin}/api/auth/callback/cognito-signup",
  ]
  logout_urls = ["${var.web_origin}/"]

  # Accounts cannot be recreated by an apply, so the pool is protected from terraform destroy.
  deletion_protection = "ACTIVE"


  ses_source_arn     = aws_sesv2_email_identity.mail.arn
  from_email_address = var.from_email_address
}
