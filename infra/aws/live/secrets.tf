# One secret per database login (ADR-0010), and the pipeline's OpenAI key.
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

# The pipeline's OpenAI API key, for the amenities extraction (CCARE-171).
resource "aws_secretsmanager_secret" "openai" {
  name                    = "${local.name}/openai"
  description             = "OpenAI API key of the pipeline, as plain text"
  recovery_window_in_days = 7
}
