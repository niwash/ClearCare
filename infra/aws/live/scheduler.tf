# EventBridge Scheduler starts the pipeline once a day. It runs the approved
# pipeline revision (release.tf), which a deploy moves on only after the
# services pass their checks. A schedule that cannot start its task retries,
# then leaves the event in the dead-letter queue (observability.tf has the
# alarm). A task that starts and then fails is reported by the stopped-task
# rule instead.
#
# The schedule starts the task once a day. The task runs its own command: it
# restores its data directory from the raw bucket and runs every job that is
# due. The schedule stays off (var.pipeline_enabled) until the bucket holds the
# pipeline's state (infra/aws/README.md).

locals {
  # Times are UTC, after the database's backup window (rds.tf). The daily run
  # is at the time the VM's timer used.
  schedules = {
    pipeline-daily = "cron(0 6 * * ? *)"
  }
}

resource "aws_scheduler_schedule_group" "main" {
  name = local.name
}

resource "aws_sqs_queue" "scheduler_dead_letter" {
  name                      = "${local.name}-scheduler-dead-letter"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_scheduler_schedule" "pipeline" {
  for_each = local.schedules

  name                         = each.key
  group_name                   = aws_scheduler_schedule_group.main.name
  schedule_expression          = each.value
  schedule_expression_timezone = "UTC"
  state                        = var.pipeline_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn     = local.pipeline_release
      launch_type             = "FARGATE"
      platform_version        = "1.4.0"
      enable_ecs_managed_tags = true
      propagate_tags          = "TASK_DEFINITION"

      network_configuration {
        subnets          = aws_subnet.public[*].id
        security_groups  = [aws_security_group.pipeline.id]
        assign_public_ip = true
      }
    }

    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 3
    }

    dead_letter_config {
      arn = aws_sqs_queue.scheduler_dead_letter.arn
    }
  }
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

# The scheduler can start pipeline tasks and nothing else.
resource "aws_iam_role_policy" "scheduler" {
  name = "run-scheduled-tasks"
  role = aws_iam_role.scheduler.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecs:RunTask"
        Resource = "${aws_ecs_task_definition.pipeline.arn_without_revision}:*"
        Condition = {
          ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn }
        }
      },
      {
        Effect   = "Allow"
        Action   = "ecs:TagResource"
        Resource = "arn:aws:ecs:${var.region}:${var.account_id}:task/${local.name}/*"
        Condition = {
          StringEquals = { "ecs:CreateAction" = "RunTask" }
        }
      },
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.execution["pipeline"].arn,
          aws_iam_role.task["pipeline"].arn,
        ]
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      },
      {
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.scheduler_dead_letter.arn
      },
    ]
  })
}
