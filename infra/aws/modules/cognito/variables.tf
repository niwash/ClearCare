variable "pool_name" {
  description = "Name of the Cognito user pool."
  type        = string
}

variable "domain_prefix" {
  description = "Globally unique prefix for the managed login domain."
  type        = string
}

variable "callback_urls" {
  description = "Exact callback URLs the app client may return to."
  type        = list(string)
}

variable "logout_urls" {
  description = "Exact URLs Cognito may return the visitor to after sign-out."
  type        = list(string)
}

variable "deletion_protection" {
  description = "ACTIVE in production, INACTIVE where the pool is disposable."
  type        = string
  default     = "INACTIVE"

  validation {
    condition     = contains(["ACTIVE", "INACTIVE"], var.deletion_protection)
    error_message = "deletion_protection must be ACTIVE or INACTIVE."
  }
}

variable "ses_source_arn" {
  description = "ARN of the verified SES identity account mail is sent from. Empty keeps Cognito's own sender, which AWS caps at 50 emails a day."
  type        = string
  default     = ""
}

variable "from_email_address" {
  description = "From address on account mail, when SES sends it. Must belong to the verified identity."
  type        = string
  default     = ""
}

variable "branding_enabled" {
  description = "Move the hosted pages to managed login (version 2) and give the app client the ClearCare style. Off keeps the classic hosted UI, which has no branding styles."
  type        = bool
  default     = false
}
