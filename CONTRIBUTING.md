# Contributing

## Layout

Each part of the project has its own top-level folder:

| Folder | Contents |
| --- | --- |
| `pipeline/` | Python pipeline |
| `infra/` | VM setup: systemd units and install notes |
| `web/` | Next.js site |
| `api/` | Spring Boot API (not started yet) |

## Branches

Name branches `CCARE-<n>-short-name`, e.g. `CCARE-20-start-frontend`.

## Commits and pull request titles

`CCARE-<n>: <description>`, e.g. `CCARE-6: Remove the student number markdown files`. The key links the commit to its JIRA issue.

## Pull requests

- Fill in the template.
- Every pull request needs approval from a teammate other than the author. Don't push to `main` directly.

## Checks

Run before opening a pull request:

- `pipeline/`: `uv sync && uv run pytest && uv run ruff check . && uv run pyright`
- `web/clearcare/`: `npm ci && npm run lint && npm run build`
