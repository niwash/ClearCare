variable "account_id" {
  description = "The AWS account that runs ClearCare. Terraform refuses to touch any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account id."
  }
}

variable "region" {
  description = "The region of the state bucket, the same as infra/aws/live."
  type        = string
  default     = "eu-north-1"
}
