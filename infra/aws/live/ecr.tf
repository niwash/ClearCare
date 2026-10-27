# One repository per image. CI pushes each build once, tagged sha-<commit>,
# and the task definitions name images by digest.

resource "aws_ecr_repository" "image" {
  for_each = local.images

  name                 = "${local.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Only untagged images expire. A tagged image may be what a service, a
# schedule or a rollback runs, and a count or age rule cannot tell which, so
# tagged images stay until a cleanup that knows the releases exists.
resource "aws_ecr_lifecycle_policy" "image" {
  for_each = aws_ecr_repository.image

  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged images, left by interrupted pushes"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}
