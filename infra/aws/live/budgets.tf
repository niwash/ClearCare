# A monthly cost budget of $80, with emails at $40 and $80 spent, and when the
# forecast passes $80. Credits are left out, so the emails follow what the
# account uses, not what is billed while the credits last. Budgets update a
# few times a day and stop nothing.
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = "80"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
    include_refund = false
  }

  dynamic "notification" {
    for_each = {
      actual-40   = { threshold = 50, type = "ACTUAL" }
      actual-80   = { threshold = 100, type = "ACTUAL" }
      forecast-80 = { threshold = 100, type = "FORECASTED" }
    }

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = var.budget_emails
    }
  }
}

# While the $180 of credits cover the account, the month's bill after credits
# stays at zero. This budget counts the credits and emails once that bill
# passes $1, which usually means the credits are gone. Charges a credit does
# not cover can also do it, so check the credit balance in Billing first.
resource "aws_budgets_budget" "net_spend" {
  name         = "${local.name}-net-spend"
  budget_type  = "COST"
  limit_amount = "1"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = true
    include_refund = false
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_emails
  }
}
