# One load balancer for both hostnames. DNS stays at Cloudflare: the
# certificate is validated with CNAME records added there by hand, and the
# hostnames point at the load balancer's DNS name (README.md).

resource "aws_acm_certificate" "public" {
  domain_name               = var.site_hostname
  subject_alternative_names = [var.api_hostname]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Waits until the CNAME records are in Cloudflare. They stay there, because
# ACM checks them again at each renewal.
resource "aws_acm_certificate_validation" "public" {
  certificate_arn = aws_acm_certificate.public.arn

  timeouts {
    create = "2h"
  }
}

resource "aws_lb" "main" {
  name                       = local.name
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = aws_subnet.public[*].id
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "web" {
  name                 = "${local.name}-web"
  target_type          = "ip"
  protocol             = "HTTP"
  port                 = 3000
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/"
    matcher = "200"
  }
}

resource "aws_lb_target_group" "api" {
  name                 = "${local.name}-api"
  target_type          = "ip"
  protocol             = "HTTP"
  port                 = 8080
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  # Up when the API can reach the database (HealthTest in api/).
  health_check {
    path    = "/actuator/health"
    matcher = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

# A request for any other hostname gets 404.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.public.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

# The load balancer checks the API's health directly, so the public has no
# need for /actuator.
resource "aws_lb_listener_rule" "api_actuator" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    host_header {
      values = [var.api_hostname]
    }
  }

  condition {
    path_pattern {
      values = ["/actuator", "/actuator/*"]
    }
  }

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  condition {
    host_header {
      values = [var.api_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  condition {
    host_header {
      values = [var.site_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
