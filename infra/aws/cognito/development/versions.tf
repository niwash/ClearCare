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
    key          = "cognito-dev/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}
