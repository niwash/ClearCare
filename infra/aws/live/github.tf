# GitHub Actions signs in with short-lived OIDC tokens; no AWS key is stored
# in the repository. Both roles trust only workflows that run on main, so a
# pull request, a fork or another branch cannot use them. The repository uses
# GitHub's immutable subject, which names the owner and the repository by id
# as well as by name. The build role
# pushes images; the deploy role runs tasks and updates the services
# (.github/workflows/aws-*.yml).

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_oidc_subject_prefix}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_build" {
  name                 = "${local.name}-github-build"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "github_build" {
  name = "push-images"
  role = aws_iam_role.github_build.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:GetDownloadUrlForLayer",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = [for repository in aws_ecr_repository.image : repository.arn]
      },
      {
        # The build starts a deploy only while deploys are enabled.
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = aws_ssm_parameter.gate["deploy"].arn
      },
    ]
  })
}

# A pipeline run takes a few hours, and the workflow waits for it.
resource "aws_iam_role" "github_deploy" {
  name                 = "${local.name}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 21600
}

locals {
  # The one-off tasks the workflows may start, and the families a deploy
  # registers revisions of.
  run_task_families          = ["pipeline", "migrate", "restore"]
  deployed_families          = ["web", "api", "pipeline", "migrate"]
  task_definition_arn_prefix = "arn:aws:ecs:${var.region}:${var.account_id}:task-definition/${local.name}"
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadImagesAndTaskDefinitions"
        Effect = "Allow"
        Action = [
          "ecr:DescribeImages",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
        ]
        Resource = "*"
      },
      {
        Sid      = "UpdateServices"
        Effect   = "Allow"
        Action   = ["ecs:DescribeServices", "ecs:UpdateService"]
        Resource = [for service in aws_ecs_service.service : service.id]
      },
      {
        Sid    = "RunOneOffTasks"
        Effect = "Allow"
        Action = "ecs:RunTask"
        Resource = flatten([
          for family in local.run_task_families : [
            "${local.task_definition_arn_prefix}-${family}",
            "${local.task_definition_arn_prefix}-${family}:*",
          ]
        ])
        Condition = {
          ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn }
        }
      },
      {
        Sid      = "FollowTasks"
        Effect   = "Allow"
        Action   = ["ecs:DescribeTasks", "ecs:StopTask"]
        Resource = "arn:aws:ecs:${var.region}:${var.account_id}:task/${local.name}/*"
      },
      {
        # RunTask tags the task with its task definition's tags.
        Sid      = "TagNewTasks"
        Effect   = "Allow"
        Action   = "ecs:TagResource"
        Resource = "arn:aws:ecs:${var.region}:${var.account_id}:task/${local.name}/*"
        Condition = {
          StringEquals = { "ecs:CreateAction" = "RunTask" }
        }
      },
      {
        # A new revision keeps the tags of the one it copies.
        Sid      = "TagNewTaskDefinitions"
        Effect   = "Allow"
        Action   = "ecs:TagResource"
        Resource = [for family in local.deployed_families : "${local.task_definition_arn_prefix}-${family}:*"]
        Condition = {
          StringEquals = { "ecs:CreateAction" = "RegisterTaskDefinition" }
        }
      },
      {
        # A deploy waits until no pipeline task is running before it migrates.
        Sid      = "ListPipelineTasks"
        Effect   = "Allow"
        Action   = "ecs:ListTasks"
        Resource = "*"
        Condition = {
          ArnEquals = { "ecs:cluster" = aws_ecs_cluster.main.arn }
        }
      },
      {
        # A deploy moves the pipeline schedules to its revision.
        Sid      = "MovePipelineSchedules"
        Effect   = "Allow"
        Action   = ["scheduler:GetSchedule", "scheduler:UpdateSchedule"]
        Resource = [for schedule in aws_scheduler_schedule.pipeline : schedule.arn]
      },
      {
        Sid      = "PassSchedulerRole"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.scheduler.arn
        Condition = {
          StringEquals = { "iam:PassedToService" = "scheduler.amazonaws.com" }
        }
      },
      {
        Sid    = "PassTaskRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = concat(
          [for role in aws_iam_role.execution : role.arn],
          [for role in aws_iam_role.task : role.arn],
        )
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      },
      {
        Sid    = "RecordReleases"
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:PutParameter"]
        Resource = concat(
          [for parameter in aws_ssm_parameter.image : parameter.arn],
          [aws_ssm_parameter.pipeline_release.arn],
        )
      },
      {
        Sid    = "ReadGatesAndNetworks"
        Effect = "Allow"
        Action = "ssm:GetParameter"
        Resource = concat(
          [for parameter in aws_ssm_parameter.gate : parameter.arn],
          [for parameter in aws_ssm_parameter.network : parameter.arn],
          [aws_ssm_parameter.public_endpoints.arn],
        )
      },
      {
        # The workflows print a failed task's log.
        Sid      = "ReadTaskLogs"
        Effect   = "Allow"
        Action   = "logs:GetLogEvents"
        Resource = [for group in aws_cloudwatch_log_group.task : "${group.arn}:*"]
      },
    ]
  })
}
