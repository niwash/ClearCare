# Contributing

## Layout

Each part of the project has its own top-level folder:

| Folder | Contents |
| --- | --- |
| `pipeline/` | Python pipeline |
| `db/` | SQL migrations, applied by Flyway ([ADR-0010](docs/adr/0010-schema-in-sql-migrations.md)) |
| `infra/` | VM setup: systemd units, the deployment Compose file and install notes |
| `infra/postgres/` | Database roles, created once before the first migration |
| `web/` | Next.js site |
| `api/` | Spring Boot API |

## Branches

Name branches `CCARE-<n>-short-name`, e.g. `CCARE-20-start-frontend`.

## Commits and pull request titles

`CCARE-<n>: <description>`, e.g. `CCARE-6: Remove the student number markdown files`. The key links the commit to its JIRA issue.

## Pull requests

- Fill in the template.
- Every pull request needs approval from a teammate other than the author. Don't push to `main` directly.

## Checks

GitHub Actions runs these checks on every pull request. Run them locally before opening one:

- `pipeline/`: `uv sync && uv run pytest && uv run ruff check . && uv run ruff format --check . && uv run pyright`. The database tests need Docker. Without Docker, skip them with `uv run pytest -m "not database"`.
- `web/clearcare/`: `npm ci && npm run lint && npm run build`
- `api/`: `./mvnw verify`. The tests need Docker, like the pipeline's database tests.

## Local database

`compose.yaml` runs PostgreSQL and applies the migrations in `db/` with Flyway. It needs Docker.

Copy `.env.example` to `.env`. Its passwords are for local development only. Then start the database and apply the migrations:

```sh
docker compose up migrate
```

The first run creates the database in a Docker volume, and `infra/postgres/roles.sql` creates the roles. Flyway prints what it applied and exits, and the database keeps running. The command returns 0 even when a migration fails, so check that the output ends with `migrate-1 exited with code 0`. Run the same command after adding a migration. `docker compose stop` stops the database and keeps its data.

The database is `clearcare` on `127.0.0.1`, port 5432. If another PostgreSQL already uses that port, set `CLEARCARE_DB_PORT` in `.env`. Log in as `clearcare_pipeline` or `clearcare_api` with the password from `.env`; each role can do only what the migrations grant it. For a superuser shell, run `docker compose exec db psql -U postgres -d clearcare`.

To start again from an empty database, run `docker compose down -v`, which deletes the volume and all local data, then `docker compose up migrate`.

If `roles.sql` fails on the first run, the `db` log shows the error and Flyway cannot log in. The image runs `roles.sql` only when it starts on an empty volume, so restarting does not retry it. Delete the volume as above, or keep it and fix the cause: run `docker compose up -d db` so the container picks up any change to `.env`, then run `roles.sql` again as the superuser and apply the migrations:

```sh
docker compose exec db psql -U postgres -d clearcare -f /docker-entrypoint-initdb.d/roles.sql
docker compose up migrate
```

## Pipeline and API

`docker compose up -d` also builds and starts the API and the pipeline once the migrations have run. The API is on `127.0.0.1:8080`; set `CLEARCARE_API_PORT` in `.env` to change the port.

The pipeline keeps its files in `./data`, unless `CLEARCARE_DATA_DIR` names another directory. When it starts, it loads the newest register snapshot there into the database. `CLEARCARE_CRAWL` sets what it downloads from HIQA:

- `off`, the default: nothing.
- A county as the register spells it, such as `Kildare`: the registers once a day, and the reports of that county's centres once a week.
- `all`: the same for every centre in the register. The first run makes a few thousand requests at least 3 seconds apart, so it takes a few hours.

If the five `CLEARCARE_S3_*` settings are set, the pipeline copies new files to the bucket when it starts and after each download, failed or not. After a register download it also loads the register. A failed report download is tried again a day later.

`schedule-state.json` in the data directory holds each job's last success and next attempt. To run both jobs now, stop the pipeline with `docker compose stop pipeline`, delete the file, and start it again with `docker compose start pipeline`.

To follow its log, run `docker compose logs -f pipeline`.

On Linux, create the data directory before the first start, and set `CLEARCARE_PIPELINE_UID` and `CLEARCARE_PIPELINE_GID` to its owner. Otherwise Docker creates the directory as root and the pipeline cannot write to it.
