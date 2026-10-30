# ClearCare on AWS

ClearCare runs in one AWS account in eu-north-1, the region AWS assigned to the account. The site and the API are ECS services on Fargate behind one load balancer. The pipeline, the migrations and restores run as one-off Fargate tasks. The database is RDS PostgreSQL 18.6. DNS stays at Cloudflare. Vercel keeps building the site for pull-request previews and for `main` (clear-care-nine.vercel.app); both read the production API, so they are previews of the site, not a separate environment.

| Path | Contents |
| --- | --- |
| `bootstrap/` | The S3 bucket for the Terraform state, created once |
| `live/` | Everything else, one file per concern |
| `live/rds-ca/` | The RDS certificate bundle the database clients check the server against |
| `cognito/` | The account pool for public sign-up and sign-in, one folder per environment |
| `migrate/Dockerfile` | Flyway with the migrations in `db/` |
| `bin/` | The scripts the workflows and the operator run |

The images are built from `api/Dockerfile`, `web/clearcare/Dockerfile`, `pipeline/Dockerfile` and `migrate/Dockerfile`. The workflows are `.github/workflows/aws-*.yml`.

The commands below need Terraform 1.17, the AWS CLI v2, jq, curl and bash, and credentials for the account with write access. Each block starts in the repository's root folder. The workflows need no AWS access from the person who runs them.

## Who owns what

Terraform owns the infrastructure and every task-definition setting. The deploy workflow owns which image runs and which pipeline revision the schedules start. It records them in the SSM parameters `/clearcare/image/<name>` and `/clearcare/release/pipeline`. Terraform reads those records back, so an apply never brings back an older image or moves the schedules. A setting that Terraform changes in a task definition reaches the services and the schedules at the next deploy.

Two switches in `terraform.tfvars` say what may change the database. Both start as `false`:

- `deploys_enabled`: the deploy and migrate workflows. Turn it on once the database has its roles and its data (First apply, step 9).
- `pipeline_enabled`: the pipeline's schedules and the run-pipeline workflow. Turn it on once the pipeline can run as a finite task: it restores its data directory from the raw bucket, exits non-zero when a stage fails, and holds a database lock that keeps two runs apart and that every migration also takes, so no pipeline task writes while Flyway runs. None of that exists yet.

## Create the state bucket

Once per account, with the account id in a variable for the commands below:

```sh
ACCOUNT_ID=123456789012
cd infra/aws/bootstrap
terraform init
terraform apply -var "account_id=$ACCOUNT_ID"
aws s3 cp terraform.tfstate "s3://$(terraform output -raw state_bucket)/bootstrap/terraform.tfstate"
```

The last command keeps a copy of this folder's state in the bucket it describes. To change the bucket later, copy the state back first.

## First apply

Terraform and the scripts in `bin/` use the AWS CLI's credentials, so select this account's profile first, for example `export AWS_PROFILE=clearcare`; rejected credentials usually mean another profile was picked up.

The task definitions need images, and the images need the repositories and the build role. The database needs its roles and its data before anything migrates it. So the first apply comes in steps.

1. Copy `infra/aws/live/terraform.tfvars.example` to `infra/aws/live/terraform.tfvars` and fill it in. Leave the zero digests and both switches `false` for now.
2. Initialise, then create the repositories, the build role and the certificate:

   ```sh
   cd infra/aws/live
   terraform init -backend-config="bucket=clearcare-terraform-state-$ACCOUNT_ID"
   terraform apply -target=aws_iam_role_policy.github_build -target=aws_acm_certificate.public
   terraform output certificate_validation_records
   ```

3. Add each validation record in Cloudflare as a CNAME, DNS only. Keep them: ACM checks them again when it renews the certificate.
4. Set the repository variable `AWS_ACCOUNT_ID` in GitHub (Settings, Secrets and variables, Actions, Variables). Until it is set, the AWS workflows skip their jobs.
5. Build the images: the next push to `main` does it once the checks pass, or re-run the latest Checks run on `main`. The build does not deploy while deploys are off. Then read the digests:

   ```sh
   COMMIT=$(git rev-parse origin/main)
   for image in api web pipeline migrate; do
     aws ecr describe-images --repository-name "clearcare/$image" \
         --image-ids "imageTag=sha-$COMMIT" --query 'imageDetails[0].imageDigest' --output text
   done
   ```

6. Put the digests in `terraform.tfvars` and apply everything from `infra/aws/live`: `terraform apply`. It waits until ACM has issued the certificate. Until step 10 the API's tasks cannot start, and its no-healthy-target alarm is on.
7. Set the database passwords and create the roles with `infra/aws/bin/create-roles` (Database passwords and roles, below).
8. Restore the production dump (Dumps and restore, below). It brings the schema and its Flyway history, so no migration runs before it.
9. Check the restored data. Then set `deploys_enabled = true` and apply.
10. Run the AWS deploy workflow for the commit. Flyway applies only the migrations the dump lacks, and the smoke check tests both hostnames through the load balancer.
11. Only once that passes, point the API hostname at `terraform output -raw load_balancer_dns_name` with a CNAME record in Cloudflare. Until then the site in AWS still fetches its data through the API hostname, from wherever that points.
12. Once the new record is visible, run `infra/aws/bin/smoke-check` again. The site in AWS now reads the API in AWS.
13. Only if that passes, point the site hostname at the load balancer too.

Each address in `alert_emails` gets an email from AWS and must confirm the subscription before any alarm reaches it.

A database for trying things out is different: it can start empty, with `deploys_enabled = true` from the start, and the first deploy applies every migration.

## Accounts (Cognito)

Public accounts live in a Cognito user pool, one root per environment: `cognito/development` and `cognito/production` both call `modules/cognito`. The development root creates the pool, its sign-in domain and one confidential app client for the site to sign in with. `domain_prefix` comes from `terraform.tfvars` because Cognito requires the name to be globally unique.

| Output | Web variable |
| --- | --- |
| `issuer` | `AUTH_COGNITO_ISSUER` |
| `client_id` | `AUTH_COGNITO_ID` |
| `client_secret` | `AUTH_COGNITO_SECRET` |
| `domain` | `COGNITO_DOMAIN` |

```sh
cd infra/aws/cognito/development
terraform init -backend-config="bucket=clearcare-terraform-state-$ACCOUNT_ID"
terraform apply
terraform output -raw client_secret
```

The sign-in domain runs the classic hosted UI, managed login version 1. The branded version 2 needs a branding style per app client, which would be a change of its own.

Cognito serves the discovery document on the pool's issuer, not on the login domain, so ask it there:

```sh
curl -s -o /dev/null -w '%{http_code}\n' \
    "$(terraform output -raw issuer)/.well-known/openid-configuration"
```

Callback and logout URLs are matched exactly, so a Vercel preview address has to be registered in `web_origin` before that preview can sign anyone in.

No pool exists in the project account yet. Until one does, development runs against a pool in a personal test account, with its state kept in this folder rather than in the bucket; `account_id` names that account in the operator's own `terraform.tfvars`. Creating the pool in the project account is a one-off apply from this folder once the bucket exists.

## Database passwords and roles

Terraform creates one secret per login role but leaves the values out, so no password is in the state. Set each one once, as plain text, with a long random value:

```sh
for role in api pipeline migrator; do
  aws secretsmanager put-secret-value --secret-id "clearcare/database/$role" \
      --secret-string "$(openssl rand -hex 32)"
done
```

RDS keeps the administrator's password in a secret of its own (`terraform output database_secret_arns`).

Create the roles once, after the passwords are set and before the restore:

```sh
infra/aws/bin/create-roles
```

It adapts `infra/postgres/roles.sql` for RDS, where the administrator is not a superuser, and runs it with the restore task's psql as the administrator. The SQL holds the passwords, so it goes through the dumps bucket and is deleted, with all its versions, when the script ends. A `CREATE ROLE` that fails leaves its statement, password included, in the database's PostgreSQL log; set that password again before retrying.

A task reads its secret when it starts. After changing a password, change it in the database too, then start new tasks: run the deploy workflow again for the running commit.

The pipeline also reads an OpenAI API key from `clearcare/openai`, whose value Terraform leaves out too. Paste the key at the prompt, which keeps it out of the shell history:

```sh
read -rs key
aws secretsmanager put-secret-value --secret-id clearcare/openai --secret-string "$key"
```

A pipeline task does not start while this secret has no value, so set it before `pipeline_enabled`. The apply that adds the secret registers a pipeline revision that reads it, but the schedules keep the one recorded in `/clearcare/release/pipeline`: run the deploy workflow for the running commit afterwards, so they start the new one.

## Plan and apply

```sh
cd infra/aws/live
terraform plan
terraform apply
```

The state is locked in the bucket while a command runs. An apply that changes a task definition registers a new revision; run the deploy workflow for the running commit to put it into service.

## Deploy

Every push to `main` deploys itself once deploys are enabled. After the Checks workflow passes, AWS build pushes the four images, tagged `sha-<commit>`, and calls AWS deploy for the commit the checks ran on. If `main` has moved on by then, the deploy skips that commit, because the newer commit's own build deploys it. The VM deploy is a workflow of its own, so the AWS build no longer depends on it. AWS deploy runs `infra/aws/bin/deploy`:

1. Stops, without changing anything, if an image is missing or a pipeline task is running.
2. Registers a migrate revision with the new image, runs it and waits for exit code 0.
3. Moves the API, then the site, to revisions with the new images. It waits until each is stable and fails if ECS rolled it back.
4. Checks both hostnames through the load balancer: the API must return centres for Dublin, the site's search page must list the first of them, and `/actuator` must not be public. On a failure it prints the revisions that ran before, for the rollback.
5. Registers a pipeline revision, moves both pipeline schedules to it and records it with its image (`infra/aws/bin/release-pipeline`). If one of those writes fails, or the deploy is cancelled, it puts the earlier release back; if it cannot, it prints the command that does.

A failed step stops the deploy there. To deploy an earlier commit again, run AWS deploy by hand with its full hash. ECR keeps the images of the last 30 pushes; an older commit has to be built again first, by re-running its Checks run.

A migration is not undone by a rollback. Write migrations that the running API can live with.

## Roll back

Run the AWS rollback workflow with the service and the revision to go back to. `aws ecs list-task-definitions --family-prefix clearcare-api --sort DESC` lists the revisions, and the ECS console shows each one's image. The workflow records that revision's image, so the next apply keeps it. A revision older than the last 30 pushes cannot start, because ECR has expired its image; deploy that commit again instead (Deploy, above).

## Read the logs

Each task family logs to `/clearcare/<family>`: `web` and `api` for two weeks, `pipeline`, `migrate` and `restore` for a month.

```sh
aws logs tail /clearcare/api --follow
aws logs tail /clearcare/pipeline --since 1d
```

The ECS console shows the same logs under each task.

## Run a one-off task

These workflows run tasks with their own AWS role:

- AWS run pipeline runs one stage, or the scheduler once, and waits for it. It runs only while the pipeline is enabled.
- AWS migrate runs Flyway's `migrate`, `info` or `validate`. It runs only while deploys are enabled.

Both share one queue with the deploys, so one of these workflows never runs during a deploy, and a deploy does not start while a pipeline task runs. A scheduled run could still start during a migration; the database lock that prevents it comes before `pipeline_enabled` (Who owns what). Cancelling the workflow stops the task.

With credentials, `infra/aws/bin/run-task` does the same from a terminal:

```sh
infra/aws/bin/run-task migrate info
infra/aws/bin/run-task --timeout 300 pipeline clearcare_pipeline.load_register --data-dir /tmp --allow-shrink
```

It prints the end of each container's log and exits 0 only if every container exited with 0. Stopping it with Ctrl-C stops the task.

## Dumps and restore

The restore task loads a dump in `pg_dump`'s custom format into an empty `clearcare` database, in one transaction, as the RDS administrator. The roles must exist first (Database passwords and roles). Upload the dump, then run the restore:

```sh
aws s3 cp clearcare.dump "s3://clearcare-dumps-$ACCOUNT_ID/restore/clearcare.dump"
infra/aws/bin/run-task --timeout 60 --container download --set DUMP_KEY=restore/clearcare.dump restore
```

If it fails, nothing is restored, and the log names the statement that failed. Dumps stay in the bucket until someone deletes them. There is no scheduled dump yet. RDS keeps seven days of point-in-time recovery, which restores into a new instance:

```sh
group=$(aws rds describe-db-instances --db-instance-identifier clearcare \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier clearcare \
  --target-db-instance-identifier clearcare-restored --use-latest-restorable-time \
  --db-instance-class db.t4g.micro --db-subnet-group-name clearcare \
  --vpc-security-group-ids "$group" --no-publicly-accessible
```

`--restore-time` instead of `--use-latest-restorable-time` picks an earlier moment. The new instance keeps the administrator's password, so the restore task can look inside it: start it with `aws ecs run-task` overrides that set the `download` container's command to `true`, and `pg_restore`'s to `psql` with `PGHOST` set to the new instance's address (`bin/run-task` overrides only one container). The network configuration is in the SSM parameter `/clearcare/network/restore`. Delete the instance afterwards with `aws rds delete-db-instance --db-instance-identifier clearcare-restored --skip-final-snapshot --delete-automated-backups`.

Tried on 29 October 2026: the new instance answered 12 minutes after the request, held the database as it was three minutes before the request, and every table had the same row count as the live one. Moving the services onto a restored instance has not been tried.

## Alarms

Alarms go by email to `alert_emails`:

- The load balancer, or one of the services, answered 5xx five times in five minutes.
- A service has had no healthy task for three minutes.
- The database has less than 5 GiB free, or its CPU has been above 80% for 15 minutes.
- A pipeline, migrate or restore task stopped with a non-zero exit code, or failed to start.
- A schedule could not start its task.

The budget emails `budget_emails` when the month's usage reaches $40 and $80, and when its forecast passes $80. They report usage. Credits are left out. A second budget emails them when a month's bill after credits passes $1, which usually means the credits are used up; the credit balance in Billing confirms it.

## Team access

The account was created with AWS's project sign-up, so people get into the console by invitation, not through IAM users: in [AWS Settings](https://settings.aws.com), open the project and invite the teammate's email address. IAM users in this account can only be used for programmatic access. The Terraform state bucket and the secrets' values stay with the operator; changes go through the workflows.
