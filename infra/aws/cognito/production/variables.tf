variable "aws_region" {
  description = "Region the production pool is created in. The rest of ClearCare runs in eu-north-1."
  type        = string
  default     = "eu-north-1"
}

variable "account_id" {
  description = "AWS account the production pool belongs to. The provider refuses to run anywhere else."
  type        = string
}

variable "domain_prefix" {
  description = "Managed login domain prefix, set in terraform.tfvars so the name is not committed."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", var.domain_prefix))
    error_message = "Use lowercase letters, digits and hyphens, starting and ending with a letter or digit."
  }
}

variable "web_origin" {
  description = "Origin of the public site. Cognito matches callback and logout URLs exactly, so this has to be the address visitors actually use."
  type        = string

  validation {
    condition     = can(regex("^https://[a-z0-9.-]+$", var.web_origin))
    error_message = "Use a scheme and host only, with no trailing slash and no path: https://clearcare.example.com"
  }
}

variable "ses_domain" {
  description = "Domain verified in SES for account mail. Its DKIM records have to be published before Cognito can send through it."
  type        = string
}

variable "from_email_address" {
  description = "From address on account mail. Must be on the verified domain, in Name <address> form."
  type        = string

  validation {
    condition     = can(regex("^[^<>]*<[^@<> ]+@[^@<> ]+>$", var.from_email_address))
    error_message = "Use the form ClearCare <no-reply@example.com>."
  }
}
