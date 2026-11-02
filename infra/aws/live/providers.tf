terraform {
  required_version = "~> 1.17.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.70"
    }
  }

  # The bucket comes from infra/aws/bootstrap and is passed to terraform init
  # (README.md), because its name holds the account id.
  backend "s3" {
    key          = "prod/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      project = "clearcare"
      env     = "prod"
    }
  }
}

locals {
  name = "clearcare"
  # The images CI builds, one ECR repository each.
  images = toset(["api", "web", "pipeline", "migrate"])
}
