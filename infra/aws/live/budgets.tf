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
