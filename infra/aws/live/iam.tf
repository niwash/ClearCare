# Roles for the tasks. Each family has its own execution role, which ECS uses
# to pull the image, write the log and read the family's one secret. A task
# role is what the code inside the container may do in AWS; the site, the API
# and the migrations need none.

locals {
  task_families = toset(["web", "api", "pipeline", "migrate", "restore"])
  # Family => the one secret its execution role may read. The site has none.
  execution_secrets = {
    api      = aws_secretsmanager_secret.database["api"].arn
    pipeline = aws_secretsmanager_secret.database["pipeline"].arn
    migrate  = aws_secretsmanager_secret.database["migrator"].arn
    restore  = local.admin_secret_arn
  }
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }
}

resource "aws_iam_role" "execution" {
  for_each = local.task_families

  name               = "${local.name}-${each.key}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  for_each = aws_iam_role.execution

  role       = each.value.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secret" {
  for_each = local.execution_secrets

  name = "read-secret"
  role = aws_iam_role.execution[each.key].name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = each.value
      },
    ]
  })
}

resource "aws_iam_role" "task" {
  for_each = toset(["pipeline", "restore"])

  name               = "${local.name}-${each.key}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# The pipeline lists, reads and creates raw files. It cannot delete one, and
# a replaced object keeps its earlier version (s3.tf).
resource "aws_iam_role_policy" "pipeline_raw" {
  name = "raw-bucket"
  role = aws_iam_role.task["pipeline"].name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.bucket["raw"].arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.bucket["raw"].arn}/*"
      },
    ]
  })
}

resource "aws_iam_role_policy" "restore_read" {
  name = "dumps-bucket"
  role = aws_iam_role.task["restore"].name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.bucket["dumps"].arn}/*"
      },
    ]
  })
}
