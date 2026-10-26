# Contributing

## Layout

Each part of the project has its own top-level folder:

| Folder | Contents |
| --- | --- |
| `pipeline/` | Python pipeline |
| `db/` | SQL migrations, applied by Flyway ([ADR-0010](docs/adr/0010-schema-in-sql-migrations.md)) |
| `infra/` | VM setup: the Compose file for the VM, the deploy script and install notes |
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
- `web/clearcare/`: `npm ci && npm run lint && npm test && npm run build`
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

The pipeline keeps its files in `./data`, unless `CLEARCARE_DATA_DIR` names another directory. When it starts, it loads the newest register snapshot there into the database, and then the inspection reports stored there. A report already in the database is not parsed again. `CLEARCARE_CRAWL` sets what it downloads from HIQA:

- `off`, the default: nothing.
- A county as the register spells it, such as `Kildare`: the registers once a day, and the reports of that county's centres once a week.
- `all`: the same for every centre in the register. The first run makes a few thousand requests at least 3 seconds apart, so it takes a few hours.

Unless `CLEARCARE_CRAWL` is `off`, it also downloads the two HSE contract price lists from the [Fair Deal page](https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/about/) once a week, and records each download in `manifests/price-lists.jsonl`. It loads the newest stored copy of each list after every download and when it starts, after the register; a list already loaded from the same bytes writes nothing.

If the five `CLEARCARE_S3_*` settings are set, the pipeline copies new files to the bucket when it starts and after each download, failed or not. After a register download it also loads the register, and after a report download the reports. A failed report download is tried again a day later. Some report layouts (Restrictive Practice thematic and National Standards reports) cannot be loaded yet ([ADR-0013](docs/adr/0013-parsed-inspection-reports-loaded-in-batches.md)), so they count as failed on every run and `ingest_reports` exits 1, while the other reports still load.

`schedule-state.json` in the data directory holds each job's last success and next attempt. To run every job now, stop the pipeline with `docker compose stop pipeline`, delete the file, and start it again with `docker compose start pipeline`.

To follow its log, run `docker compose logs -f pipeline`.

Ingest also stores the inspector narrative and Section 1 responses, with PDF pages, character offsets at each page boundary, and the extractor version, `EXTRACTOR_VERSION` in `pipeline/src/clearcare_pipeline/parser/text.py`. Change that version when you change `text.csv` or the extractor. The pipeline runs `extract_text` after each ingest. It adds text for loaded reports that have none at the current version, so the first start after the version changes extracts every report again (about half an hour for the national set), and later runs add nothing. Missing files or incomplete text are logged and `extract_text` exits 1, while the stages after it still run.

After `extract_text`, the pipeline runs `split_commitments`, which appends commitments from stored responses and their page offsets. It needs no local PDFs. It uses the splitter's `rules-v3` version; change that version when changing its rules. Repeat runs write nothing new. Month-only stated deadlines retain month precision; their stored date is the last day of that month. Dates need an explicit link to the commitment or a Timeframe or Time Frame label; uncertain wording stays in the response span without a parsed deadline.

On Linux, create the data directory before the first start, and set `CLEARCARE_PIPELINE_UID` and `CLEARCARE_PIPELINE_GID` to its owner. Otherwise Docker creates the directory as root and the pipeline cannot write to it.
