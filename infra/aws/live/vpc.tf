# Two zones. The load balancer and the tasks use the public subnets: each task
# gets a public address for its outbound traffic (HIQA, HSE, ECR, Secrets
# Manager, CloudWatch Logs), which saves a NAT gateway, and the security groups
# below let nothing from the internet reach a task. The database subnets have
# no route to the internet.
#
# 10.42.10.0/24 and 10.42.11.0/24 are kept free for private application
# subnets, for when the tasks move behind NAT gateways.

resource "aws_vpc" "main" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = local.name
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = local.name
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id               = aws_vpc.main.id
  availability_zone_id = var.availability_zone_ids[count.index]
  cidr_block           = "10.42.${count.index}.0/24"

  tags = {
    Name = "${local.name}-public-${var.availability_zone_ids[count.index]}"
  }
}

resource "aws_subnet" "database" {
  count = 2

  vpc_id               = aws_vpc.main.id
  availability_zone_id = var.availability_zone_ids[count.index]
  cidr_block           = "10.42.${20 + count.index}.0/24"

  tags = {
    Name = "${local.name}-database-${var.availability_zone_ids[count.index]}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name}-public"
  }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Only the local route.
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name}-database"
  }
}

resource "aws_route_table_association" "database" {
  count = 2

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# S3 traffic from the tasks stays inside AWS and costs nothing. The policy
# admits the project's buckets and the bucket ECR keeps image layers in.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.public.id]
  policy            = data.aws_iam_policy_document.s3_endpoint.json

  tags = {
    Name = "${local.name}-s3"
  }
}

data "aws_iam_policy_document" "s3_endpoint" {
  statement {
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.bucket["raw"].arn,
      "${aws_s3_bucket.bucket["raw"].arn}/*",
      aws_s3_bucket.bucket["dumps"].arn,
      "${aws_s3_bucket.bucket["dumps"].arn}/*",
      "arn:aws:s3:::prod-${var.region}-starport-layer-bucket/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

# Security groups: who may open a connection to whom. Outbound HTTPS goes to
# any address, because the AWS endpoints and the sources have no fixed ranges.

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "The load balancer: HTTPS and HTTP from anywhere"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "web" {
  name        = "${local.name}-web"
  description = "The site: port 3000 from the load balancer"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "The API: port 8080 from the load balancer"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "pipeline" {
  name        = "${local.name}-pipeline"
  description = "The pipeline: no inbound traffic"
  vpc_id      = aws_vpc.main.id
}

# Migrations and restores.
resource "aws_security_group" "maintenance" {
  name        = "${local.name}-maintenance"
  description = "One-off database tasks: no inbound traffic"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "PostgreSQL: port 5432 from the API, the pipeline and the one-off tasks"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb" {
  for_each = toset(["80", "443"])

  security_group_id = aws_security_group.alb.id
  description       = "From anywhere; port 80 only redirects to 443"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.key)
  to_port           = tonumber(each.key)
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.api.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.web.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}

# The site calls the API through its public hostname, as it does from Vercel.
resource "aws_vpc_security_group_egress_rule" "https" {
  for_each = {
    web         = aws_security_group.web.id
    api         = aws_security_group.api.id
    pipeline    = aws_security_group.pipeline.id
    maintenance = aws_security_group.maintenance.id
  }

  security_group_id = each.value
  description       = "HTTPS to AWS endpoints and, for the pipeline, to HIQA and HSE"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "to_database" {
  for_each = {
    api         = aws_security_group.api.id
    pipeline    = aws_security_group.pipeline.id
    maintenance = aws_security_group.maintenance.id
  }

  security_group_id            = each.value
  referenced_security_group_id = aws_security_group.database.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "database" {
  for_each = {
    api         = aws_security_group.api.id
    pipeline    = aws_security_group.pipeline.id
    maintenance = aws_security_group.maintenance.id
  }

  security_group_id            = aws_security_group.database.id
  description                  = "From the ${each.key} tasks"
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
