variable "account_id" {
  description = "The AWS account that runs ClearCare. Terraform refuses to touch any other."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account id."
  }
}

variable "region" {
  description = "The region everything runs in."
  type        = string
  default     = "eu-north-1"
}

variable "availability_zone_ids" {
  description = "Two zones for the load balancer and the database subnets. Zone ids name the same zones in every account; zone names do not."
  type        = list(string)
  default     = ["eun1-az1", "eun1-az2"]

  validation {
    condition     = length(distinct(var.availability_zone_ids)) == 2 && length(var.availability_zone_ids) == 2
    error_message = "availability_zone_ids must name exactly two different zones."
  }
}

variable "github_oidc_subject_prefix" {
  description = "The start of the sub claim in the repository's GitHub OIDC tokens. GitHub prints it with: gh api repos/<owner>/<name>/actions/oidc/customization/sub --jq .sub_claim_prefix"
  type        = string

  validation {
    condition     = can(regex("^repo:[^:*]+$", var.github_oidc_subject_prefix))
    error_message = "github_oidc_subject_prefix must look like repo:<owner>@<id>/<name>@<id>, without a wildcard."
  }
}

variable "site_hostname" {
  description = "The public hostname of the site, such as clearcare.example.com."
  type        = string
}

variable "api_hostname" {
  description = "The public hostname of the API, such as api.clearcare.example.com."
  type        = string
}

variable "image_digests" {
  description = "The image each task definition starts from, by image, as sha256:<64 hex>. Used only when the task definitions are first created; after that the deploy workflow records what runs (ecs.tf)."
  type        = map(string)

  validation {
    condition     = toset(keys(var.image_digests)) == toset(["api", "web", "pipeline", "migrate"])
    error_message = "image_digests must have exactly the keys api, web, pipeline and migrate."
  }

  validation {
    condition     = alltrue([for digest in values(var.image_digests) : can(regex("^sha256:[0-9a-f]{64}$", digest))])
    error_message = "Each image digest must look like sha256:<64 lowercase hex digits>."
  }
}

variable "alert_emails" {
  description = "Addresses that get the alarms. Each address has to confirm the subscription from the email AWS sends it."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0 && alltrue([for address in var.alert_emails : can(regex("^[^@\\s]+@[^@\\s]+$", address))])
    error_message = "alert_emails must hold at least one email address."
  }
}

variable "budget_emails" {
  description = "Addresses that get the budget notifications."
  type        = list(string)

  validation {
    condition     = length(var.budget_emails) > 0 && alltrue([for address in var.budget_emails : can(regex("^[^@\\s]+@[^@\\s]+$", address))])
    error_message = "budget_emails must hold at least one email address."
  }
}


variable "deploys_enabled" {
  description = "Whether the deploy and migrate workflows may run (release.tf). Turn it on once the database has its roles and the restored data, never before."
  type        = bool
  default     = false
}

variable "pipeline_enabled" {
  description = "Whether the pipeline may run, on its schedules or from the run-pipeline workflow (release.tf). Off until the pipeline can run as a finite task (scheduler.tf)."
  type        = bool
  default     = false
}
