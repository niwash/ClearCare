# Logs, alarms and the email topic they go to.

# Two weeks for the services; a month for the one-off tasks, whose runs are
# further apart.
resource "aws_cloudwatch_log_group" "task" {
  for_each = {
    web      = 14
    api      = 14
    pipeline = 30
    migrate  = 30
    restore  = 30
  }

  name              = "/${local.name}/${each.key}"
  retention_in_days = each.value
}

resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
}

# AWS emails each address a link to confirm before it sends it anything.
resource "aws_sns_topic_subscription" "alarm_email" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.key
}

# CloudWatch alarms in this account may publish by default; the stopped-task
# rule below needs EventBridge allowed.
resource "aws_sns_topic_policy" "alarms" {
  arn = aws_sns_topic.alarms.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountOwner"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.account_id}:root" }
        Action    = ["sns:Publish", "sns:Subscribe", "sns:GetTopicAttributes", "sns:SetTopicAttributes"]
        Resource  = aws_sns_topic.alarms.arn
      },
      {
        Sid       = "CloudWatchAlarms"
        Effect    = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.alarms.arn
        Condition = { StringEquals = { "aws:SourceAccount" = var.account_id } }
      },
      {
        Sid       = "StoppedTaskRule"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sns:Publish"
        Resource  = aws_sns_topic.alarms.arn
        Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.task_failed.arn } }
      },
    ]
  })
}

# A one-off task that stopped with a non-zero exit code, or never started.
# The services' tasks are left out: a deploy stops them on purpose, and the
# load balancer alarms below cover them.
resource "aws_cloudwatch_event_rule" "task_failed" {
  name        = "${local.name}-task-failed"
  description = "A pipeline, migration or restore task failed"
  event_pattern = jsonencode({
    source        = ["aws.ecs"]
    "detail-type" = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.main.arn]
      lastStatus = ["STOPPED"]
      group      = [for family in local.run_task_families : "family:${local.name}-${family}"]
      "$or" = [
        { containers = { exitCode = [{ "anything-but" = 0 }] } },
        { stopCode = ["TaskFailedToStart"] },
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "task_failed" {
  rule = aws_cloudwatch_event_rule.task_failed.name
  arn  = aws_sns_topic.alarms.arn

  input_transformer {
    input_paths = {
      group  = "$.detail.group"
      reason = "$.detail.stoppedReason"
      task   = "$.detail.taskArn"
    }
    input_template = "\"ClearCare task <group> failed: <reason>. Task <task>. Its log is in CloudWatch Logs under /${local.name}/.\""
  }
}

locals {
  alarm_actions = [aws_sns_topic.alarms.arn]
  target_groups = {
    web = aws_lb_target_group.web
    api = aws_lb_target_group.api
  }
}

# At this traffic a percentage would hide a broken demo, so these count.
resource "aws_cloudwatch_metric_alarm" "load_balancer_5xx" {
  alarm_name          = "${local.name}-load-balancer-5xx"
  alarm_description   = "The load balancer answered 5xx itself, usually because no target was healthy"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "target_5xx" {
  for_each = local.target_groups

  alarm_name          = "${local.name}-${each.key}-5xx"
  alarm_description   = "The ${each.key} service answered 5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = each.value.arn_suffix }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# Each service runs one task, so one unhealthy target means it is down.
resource "aws_cloudwatch_metric_alarm" "no_healthy_target" {
  for_each = local.target_groups

  alarm_name          = "${local.name}-${each.key}-no-healthy-target"
  alarm_description   = "The ${each.key} service has had no healthy task for 3 minutes"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = each.value.arn_suffix }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${local.name}-database-storage"
  alarm_description   = "The database has less than 5 GiB free"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = 5 * 1024 * 1024 * 1024
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.name}-database-cpu"
  alarm_description   = "The database CPU has been above 80% for 15 minutes"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "scheduler_dead_letter" {
  alarm_name          = "${local.name}-scheduler-dead-letter"
  alarm_description   = "A schedule could not start its task (scheduler.tf)"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.scheduler_dead_letter.name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
}
