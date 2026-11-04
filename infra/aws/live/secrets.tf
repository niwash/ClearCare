# One secret per database login (ADR-0010), and the pipeline's Anthropic key.
# Terraform creates the secrets but not their values, so no password or key
# is in the state or in a plan; README.md shows how to set them. The
# administrator's secret belongs to RDS (rds.tf). Each task's execution role
# can read only its own secrets (iam.tf).

locals {
  # Secret name => the role infra/postgres/roles.sql creates.
  database_logins = {
    api      = "clearcare_api"
    pipeline = "clearcare_pipeline"
    migrator = "clearcare_migrator"
  }
}

resource "aws_secretsmanager_secret" "database" {
  for_each = local.database_logins

  name                    = "${local.name}/database/${each.key}"
  description             = "Password of the ${each.value} database role, as plain text"
  recovery_window_in_days = 7
}

locals {
  admin_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn
}

# The pipeline's Anthropic API key, for the amenities extraction (CCARE-171).
resource "aws_secretsmanager_secret" "anthropic" {
  name                    = "${local.name}/anthropic"
  description             = "Anthropic API key of the pipeline, as plain text"
  recovery_window_in_days = 7
}

# The site's session signing key and the Cognito app client secret (CCARE-183). Terraform creates
# the secrets but not their values, like the database passwords, so neither lands in state. The web
# task can only start with them once they are set, which is why ecs.tf injects them only when
# accounts_enabled is on.
resource "aws_secretsmanager_secret" "auth_session" {
  name                    = "${local.name}/auth/session-secret"
  description             = "Signing key for the encrypted session cookie; generate with openssl rand -base64 33"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "cognito_client_secret" {
  name                    = "${local.name}/auth/cognito-client-secret"
  description             = "App client secret of the Cognito pool that holds public accounts"
  recovery_window_in_days = 7
}
