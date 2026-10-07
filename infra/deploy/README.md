# Database and API on the VM

`compose.yaml` runs the database and the API on the VM as the Compose project `clearcare`, next to the pipeline's containers (ADR-0011):

- `db`: PostgreSQL, in the container `clearcare-db`, with its data in the volume `clearcare_db-data`. It publishes no port.
- `migrate`: applies the migrations in `db/` with Flyway and exits (ADR-0010).
- `api`: the API, in the container `clearcare-api`. It starts once `migrate` has finished without errors. It publishes no port either. The VM's reverse proxy reaches it on port 8080 over the proxy's Docker network, which `compose.yaml` names.

`db` and `migrate` repeat the settings of the root `compose.yaml`, so a change to an image version is made in both files.

The passwords are in `/opt/clearcare/secrets/db.env` (mode 600, owner uid 1001, never in the repository). It has the variables of `.env.example` except `CLEARCARE_DB_PORT`: `POSTGRES_PASSWORD`, `CLEARCARE_MIGRATOR_PASSWORD`, `CLEARCARE_PIPELINE_PASSWORD` and `CLEARCARE_API_PASSWORD`. Use long random strings of letters and digits, because Compose reads `$` and quotes in this file as syntax. Compose reads it as the `.env` next to `compose.yaml`, which is a link made once and ignored by git:

```sh
ln -s /opt/clearcare/secrets/db.env /opt/clearcare/src/infra/deploy/.env
```

`infra/postgres/roles.sql` sets the role passwords only when the database is first created, so a later change to the file does not change them.

## Install or update

```sh
cd /opt/clearcare/src && git pull
docker compose -f infra/deploy/compose.yaml up -d --build
```

This builds the API image, starts the database, applies any new migrations and starts the API again if its image changed.

The proxy needs a site block for the API. The hostname is not decided yet. Add the block to the proxy's Caddyfile, then run `caddy reload` in the proxy's container:

```
<hostname> {
    reverse_proxy clearcare-api:8080
}
```

## Check

```sh
docker compose -f infra/deploy/compose.yaml ps -a
docker compose -f infra/deploy/compose.yaml logs api
curl -i https://<hostname>/centres
```

`ps -a` shows `db` and `api` running and `migrate` exited with code 0. Until the register is loaded, the `curl` returns 503 with "The register has not been loaded yet."

## The pipeline

The register loader reaches the database from its container with `--network clearcare_default` and the host name `clearcare-db`, logging in as `clearcare_pipeline`. Its setup is in [infra/systemd/README.md](../systemd/README.md).

## Start again from an empty database

```sh
docker compose -f infra/deploy/compose.yaml down -v
docker compose -f infra/deploy/compose.yaml up -d --build
```

`down -v` deletes the volume and everything in it. The database holds only what the pipeline loads from the raw files in object storage (ADR-0007), so it can be rebuilt from them. There is no backup yet.
