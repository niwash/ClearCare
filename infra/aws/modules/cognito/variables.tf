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

variable "tags" {
  description = "Tags applied to every resource in the module."
  type        = map(string)
  default     = {}
}
