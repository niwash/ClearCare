# What is released, and whether releases may happen. The workflows read and
# write these SSM parameters; Terraform reads them back, so an apply keeps
# what a deploy put in place.

# Terraform owns the task-definition settings; the deploy workflow owns which
# image runs. The workflow registers a revision with a new image, then records
# the image here. Terraform builds its revisions from these records, so an
# apply never puts an older image back. image_digests sets them only once.
resource "aws_ssm_parameter" "image" {
  for_each = local.images

  name           = "/${local.name}/image/${each.key}"
  type           = "String"
  insecure_value = "${aws_ecr_repository.image[each.key].repository_url}@${var.image_digests[each.key]}"

  lifecycle {
    ignore_changes = [insecure_value]
  }
}

data "aws_ssm_parameter" "image" {
  for_each = aws_ssm_parameter.image

  name = each.value.name
}

# The pipeline revision the schedules run. A deploy moves the schedules to
# its new revision once the services pass their checks, then records it
# here (infra/aws/bin/release-pipeline). Registering a revision, by a deploy
# or by an apply, changes nothing the schedules run.
resource "aws_ssm_parameter" "pipeline_release" {
  name           = "/${local.name}/release/pipeline"
  type           = "String"
  insecure_value = aws_ecs_task_definition.pipeline.arn

  lifecycle {
    ignore_changes = [insecure_value]
  }
}

data "aws_ssm_parameter" "pipeline_release" {
  name = aws_ssm_parameter.pipeline_release.name
}

locals {
  image            = { for name, parameter in data.aws_ssm_parameter.image : name => parameter.insecure_value }
  pipeline_release = data.aws_ssm_parameter.pipeline_release.insecure_value
}

# Gates the scripts check before they change the database (infra/aws/bin).
# The AWS build reads the deploy gate before it starts a deploy.
resource "aws_ssm_parameter" "gate" {
  for_each = {
    deploy   = var.deploys_enabled
    pipeline = var.pipeline_enabled
  }

  name           = "/${local.name}/gate/${each.key}"
  type           = "String"
  insecure_value = each.value ? "enabled" : "disabled"
}

# Where the deploy's smoke check sends its requests. It connects to the load
# balancer directly, so it checks AWS before and after the DNS records move.
resource "aws_ssm_parameter" "public_endpoints" {
  name = "/${local.name}/public-endpoints"
  type = "String"
  insecure_value = jsonencode({
    load_balancer = aws_lb.main.dns_name
    api_hostname  = var.api_hostname
    site_hostname = var.site_hostname
  })
}
