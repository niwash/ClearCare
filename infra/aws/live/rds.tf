# PostgreSQL 18.6, the version compose.yaml and the tests run (ADR-0008).
# One instance in one zone: when the zone fails, the database is restored
# from a backup into the other one.

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.database[*].id
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "18.6"
  instance_class = "db.t4g.micro"
  # infra/postgres/roles.sql expects this database name.
  db_name = "clearcare"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false
  ca_cert_identifier     = "rds-ca-rsa2048-g1"

  # RDS creates the administrator's password and keeps it in Secrets Manager,
  # so it is never in the Terraform state. The application roles are created
  # with infra/postgres/roles.sql, as on a new local database.
  username                    = "clearcare_admin"
  manage_master_user_password = true

  # Seven days of point-in-time recovery. The backup and maintenance windows
  # (UTC) come before the pipeline's morning run.
  backup_retention_period = 7
  backup_window           = "01:00-01:30"
  maintenance_window      = "sun:01:45-sun:02:15"
  copy_tags_to_snapshot   = true

  # Upgrades are applied by hand after they have been tried on a copy.
  auto_minor_version_upgrade  = false
  allow_major_version_upgrade = false

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"

  lifecycle {
    prevent_destroy = true
  }
}
