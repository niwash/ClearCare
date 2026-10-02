# PostgreSQL is the database

The pipeline and the API share one PostgreSQL database. It runs on our OCI VM, and the same version runs on our laptops and in tests, so we develop against the database we deploy.

We also looked at Oracle Autonomous Database, because the OCI free tier includes it. When we checked on 28 September 2026, the free version allows at most 30 sessions, stops after 7 days without use, and doesn't let us make our own backups to object storage. Python and Java would both have to use Oracle's SQL dialect, and running it on a laptop needs a large container. The cost of choosing PostgreSQL is that we run backups and upgrades ourselves.
