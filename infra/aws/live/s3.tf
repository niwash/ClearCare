# Two private buckets: raw files (ADR-0007) and database dumps. The Terraform
# state bucket is in infra/aws/bootstrap.

locals {
  buckets = {
    raw   = "${local.name}-raw-${var.account_id}"
    dumps = "${local.name}-dumps-${var.account_id}"
  }
}

resource "aws_s3_bucket" "bucket" {
  for_each = local.buckets

  bucket = each.value

  lifecycle {
    prevent_destroy = true
  }
}

# A replaced or deleted object keeps its earlier version.
resource "aws_s3_bucket_versioning" "bucket" {
  for_each = aws_s3_bucket.bucket

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bucket" {
  for_each = aws_s3_bucket.bucket

  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "bucket" {
  for_each = aws_s3_bucket.bucket

  bucket = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "bucket" {
  for_each = aws_s3_bucket.bucket

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_policy" "bucket" {
  for_each = aws_s3_bucket.bucket

  bucket = each.value.id
  policy = data.aws_iam_policy_document.tls_only[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.bucket]
}

data "aws_iam_policy_document" "tls_only" {
  for_each = aws_s3_bucket.bucket

  statement {
    sid       = "DenyWithoutTls"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value.arn, "${each.value.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}
