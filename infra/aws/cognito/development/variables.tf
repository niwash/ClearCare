variable "aws_region" {
  description = "Region the development pool is created in. The rest of ClearCare runs in eu-north-1."
  type        = string
  default     = "eu-north-1"
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
  description = "Origin of the ClearCare web app in this environment."
  type        = string
  default     = "http://localhost:3000"
}
