# One cluster for the two services (web, api) and the tasks that run and exit
# (pipeline, migrate, restore). Every task runs on Fargate, ARM64. The task
# definitions keep their earlier revisions registered (skip_destroy), so a
# rollback can go back to one. Which image runs is recorded in release.tf.

resource "aws_ecs_cluster" "main" {
  name = local.name

  # Container Insights adds metrics at a cost; the built-in ones come first.
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

locals {
  # Images that CI does not build, from ECR Public by digest, so a task runs
  # the same bytes every time. The same PostgreSQL as compose.yaml, for
  # pg_restore. Each digest names the multi-platform index, which has
  # linux/arm64.
  postgres_image = "public.ecr.aws/docker/library/postgres:18.6@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6"
  aws_cli_image  = "public.ecr.aws/aws-cli/aws-cli:2.38.5@sha256:c8156a0e74e13929a42d7e60f0d4e14e7d28d980cd21822505d4bff80e5460c1"
  busybox_image  = "public.ecr.aws/docker/library/busybox:1.37.0@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e"

  # Every database client checks the server's certificate and hostname
  # against the RDS certificate bundle in rds-ca/ (AWS publishes it at
  # truststore.pki.rds.amazonaws.com). The images do not carry the bundle, so
  # a first container in each task writes it to a volume that the client
  # reads. The volume belongs to root, hence the user.
  rds_ca_file = "/rds-ca/eu-north-1-bundle.pem"
  rds_ca_container = {
    name      = "rds-ca"
    image     = local.busybox_image
    essential = false
    user      = "0"
    command   = ["sh", "-c", "printf '%s\\n' \"$RDS_CA_BUNDLE\" > ${local.rds_ca_file}"]
    environment = [
      { name = "RDS_CA_BUNDLE", value = trimspace(file("${path.module}/rds-ca/eu-north-1-bundle.pem")) },
    ]
    mountPoints = [{ sourceVolume = "rds-ca", containerPath = "/rds-ca" }]
  }
  rds_ca_mount      = { sourceVolume = "rds-ca", containerPath = "/rds-ca", readOnly = true }
  rds_ca_dependency = { containerName = "rds-ca", condition = "SUCCESS" }

  jdbc_url = "jdbc:postgresql://${aws_db_instance.main.address}:${aws_db_instance.main.port}/clearcare?sslmode=verify-full&sslrootcert=${local.rds_ca_file}"
  libpq_environment = [
    { name = "PGHOST", value = aws_db_instance.main.address },
    { name = "PGPORT", value = tostring(aws_db_instance.main.port) },
    { name = "PGDATABASE", value = "clearcare" },
    { name = "PGSSLMODE", value = "verify-full" },
    { name = "PGSSLROOTCERT", value = local.rds_ca_file },
  ]
}

# Each container logs to its task's log group (observability.tf), one stream
# per task.
locals {
  log_configuration = {
    for family in keys(aws_cloudwatch_log_group.task) : family => {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.task[family].name
        awslogs-region        = var.region
        awslogs-stream-prefix = family
      }
    }
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  skip_destroy             = true
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution["web"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name         = "web"
      image        = local.image["web"]
      essential    = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        # The site's server code calls the API, as it does on Vercel.
        { name = "API_URL", value = "https://${var.api_hostname}" },
        # The standalone server listens on HOSTNAME; the health check calls it on loopback.
        { name = "HOSTNAME", value = "0.0.0.0" },
      ]
      # The image has node but no curl.
      healthCheck = {
        command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
      logConfiguration = local.log_configuration["web"]
    },
  ])
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  skip_destroy             = true
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution["api"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "rds-ca"
  }

  container_definitions = jsonencode([
    merge(local.rds_ca_container, { logConfiguration = local.log_configuration["api"] }),
    {
      name         = "api"
      image        = local.image["api"]
      essential    = true
      dependsOn    = [local.rds_ca_dependency]
      mountPoints  = [local.rds_ca_mount]
      portMappings = [{ containerPort = 8080, protocol = "tcp" }]
      environment = [
        { name = "SPRING_DATASOURCE_URL", value = local.jdbc_url },
        # Half the task's memory for the heap; the rest is for the JVM itself.
        { name = "JAVA_TOOL_OPTIONS", value = "-Xms128m -Xmx512m" },
        # db.t4g.micro allows about 110 connections, shared with the pipeline
        # and the one-off tasks.
        { name = "SPRING_DATASOURCE_HIKARI_MAXIMUMPOOLSIZE", value = "5" },
        { name = "SPRING_DATASOURCE_HIKARI_MINIMUMIDLE", value = "1" },
      ]
      secrets = [
        { name = "CLEARCARE_API_PASSWORD", valueFrom = aws_secretsmanager_secret.database["api"].arn },
      ]
      healthCheck = {
        command     = ["CMD", "curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:8080/actuator/health"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 120
      }
      logConfiguration = local.log_configuration["api"]
    },
  ])
}

resource "aws_ecs_task_definition" "pipeline" {
  family                   = "${local.name}-pipeline"
  skip_destroy             = true
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.execution["pipeline"].arn
  task_role_arn            = aws_iam_role.task["pipeline"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "rds-ca"
  }

  container_definitions = jsonencode([
    merge(local.rds_ca_container, { logConfiguration = local.log_configuration["pipeline"] }),
    {
      name        = "pipeline"
      image       = local.image["pipeline"]
      essential   = true
      dependsOn   = [local.rds_ca_dependency]
      mountPoints = [local.rds_ca_mount]
      # The image's entrypoint is python -m. /tmp is the one directory its
      # user can write to; it is on the task's own storage and is gone when the
      # task ends. The run-pipeline workflow replaces this command.
      command = ["clearcare_pipeline.schedule", "--data-dir", "/tmp", "--once"]
      environment = concat(local.libpq_environment, [
        { name = "PGUSER", value = local.database_logins.pipeline },
        { name = "CLEARCARE_CRAWL", value = "all" },
      ])
      secrets = [
        { name = "PGPASSWORD", valueFrom = aws_secretsmanager_secret.database["pipeline"].arn },
      ]
      # Passes the stop signal on to Python, which ignores it as process 1,
      # as init: true does in compose.yaml.
      linuxParameters  = { initProcessEnabled = true }
      logConfiguration = local.log_configuration["pipeline"]
    },
  ])
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  skip_destroy             = true
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution["migrate"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "rds-ca"
  }

  container_definitions = jsonencode([
    merge(local.rds_ca_container, { logConfiguration = local.log_configuration["migrate"] }),
    {
      name        = "migrate"
      image       = local.image["migrate"]
      essential   = true
      dependsOn   = [local.rds_ca_dependency]
      mountPoints = [local.rds_ca_mount]
      # The image runs flyway migrate unless the command names another
      # Flyway command, such as info or validate.
      environment = [
        { name = "FLYWAY_URL", value = local.jdbc_url },
        { name = "FLYWAY_USER", value = local.database_logins.migrator },
      ]
      secrets = [
        { name = "FLYWAY_PASSWORD", valueFrom = aws_secretsmanager_secret.database["migrator"].arn },
      ]
      logConfiguration = local.log_configuration["migrate"]
    },
  ])
}

# Restores a dump from the dumps bucket into an empty clearcare database, as
# the RDS administrator. The roles must exist first (infra/postgres/roles.sql).
# DUMP_KEY, the dump's key in the bucket, is set when the task is run
# (README.md).
resource "aws_ecs_task_definition" "restore" {
  family                   = "${local.name}-restore"
  skip_destroy             = true
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution["restore"].arn
  task_role_arn            = aws_iam_role.task["restore"].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "dump"
  }

  volume {
    name = "rds-ca"
  }

  container_definitions = jsonencode([
    merge(local.rds_ca_container, { logConfiguration = local.log_configuration["restore"] }),
    {
      name        = "download"
      image       = local.aws_cli_image
      essential   = false
      mountPoints = [{ sourceVolume = "dump", containerPath = "/dump" }]
      entryPoint  = ["sh", "-c"]
      command     = ["aws s3 cp \"s3://$DUMPS_BUCKET/$DUMP_KEY\" /dump/clearcare.dump"]
      environment = [
        { name = "DUMPS_BUCKET", value = aws_s3_bucket.bucket["dumps"].id },
        { name = "DUMP_KEY", value = "" },
      ]
      logConfiguration = local.log_configuration["restore"]
    },
    {
      name      = "pg_restore"
      image     = local.postgres_image
      essential = true
      dependsOn = [
        { containerName = "download", condition = "SUCCESS" },
        local.rds_ca_dependency,
      ]
      # One transaction, so a failed restore leaves the database empty. The
      # objects belong to clearcare_owner and keep their grants.
      command = [
        "pg_restore", "--exit-on-error", "--single-transaction", "--no-owner",
        "--role=clearcare_owner", "--dbname=clearcare", "/dump/clearcare.dump",
      ]
      mountPoints = [
        { sourceVolume = "dump", containerPath = "/dump", readOnly = true },
        local.rds_ca_mount,
      ]
      environment = local.libpq_environment
      secrets = [
        { name = "PGUSER", valueFrom = "${local.admin_secret_arn}:username::" },
        { name = "PGPASSWORD", valueFrom = "${local.admin_secret_arn}:password::" },
      ]
      logConfiguration = local.log_configuration["restore"]
    },
  ])
}

# The network each one-off task runs in, for the workflows' run-task calls
# (infra/aws/bin/run-task).
resource "aws_ssm_parameter" "network" {
  for_each = {
    pipeline = aws_security_group.pipeline.id
    migrate  = aws_security_group.maintenance.id
    restore  = aws_security_group.maintenance.id
  }

  name = "/${local.name}/network/${each.key}"
  type = "String"
  insecure_value = jsonencode({
    awsvpcConfiguration = {
      subnets        = aws_subnet.public[*].id
      securityGroups = [each.value]
      assignPublicIp = "ENABLED"
    }
  })
}

# The services. One task each; a deploy starts the new task before it stops
# the old one, and rolls back when the new one does not become healthy.
locals {
  services = {
    web = {
      task_definition = aws_ecs_task_definition.web.arn
      security_group  = aws_security_group.web.id
      target_group    = aws_lb_target_group.web.arn
      port            = 3000
      grace_seconds   = 60
    }
    api = {
      task_definition = aws_ecs_task_definition.api.arn
      security_group  = aws_security_group.api.id
      target_group    = aws_lb_target_group.api.arn
      port            = 8080
      grace_seconds   = 120
    }
  }
}

resource "aws_ecs_service" "service" {
  for_each = local.services

  name             = each.key
  cluster          = aws_ecs_cluster.main.id
  task_definition  = each.value.task_definition
  desired_count    = 1
  launch_type      = "FARGATE"
  platform_version = "1.4.0"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = each.value.grace_seconds

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [each.value.security_group]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = each.value.target_group
    container_name   = each.key
    container_port   = each.value.port
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  # The deploy workflow moves the services to new revisions (release.tf).
  lifecycle {
    ignore_changes = [task_definition]
  }

  # ECS accepts a target group only once a listener rule forwards to it.
  depends_on = [aws_lb_listener_rule.api, aws_lb_listener_rule.web]
}
