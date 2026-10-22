# ClearCare on the VM

The VM runs the root `compose.yaml` with this folder's `compose.yaml` on top, as the Compose project `clearcare` (ADR-0011, ADR-0014). The second file names the containers `clearcare-db` and `clearcare-api`, publishes no port, puts the API on the reverse proxy's Docker network, and runs the pipeline as uid 1001 on `/opt/clearcare/data` with `CLEARCARE_CRAWL=all`. The database's data is in the volume `clearcare_db-data`.

## Settings

The settings are in `/opt/clearcare/secrets` (mode 600, owner uid 1001, never in the repository):

- `db.env`: `POSTGRES_PASSWORD`, `CLEARCARE_MIGRATOR_PASSWORD`, `CLEARCARE_PIPELINE_PASSWORD` and `CLEARCARE_API_PASSWORD`. Use long random strings of letters and digits, because Compose reads `$` and quotes in this file as syntax. `infra/postgres/roles.sql` sets the role passwords only when the database is first created, so a later change to the file does not change them.
- `object-storage.env`: `CLEARCARE_S3_ENDPOINT`, `CLEARCARE_S3_REGION`, `CLEARCARE_S3_BUCKET`, `CLEARCARE_S3_ACCESS_KEY_ID` and `CLEARCARE_S3_SECRET_ACCESS_KEY`, for the `clearcare-raw` bucket. The bucket's policy lets these credentials create and read objects but never overwrite or delete them.

Compose fills in `compose.yaml` from both files. Every command below runs in `/opt/clearcare/src` after:

```sh
export COMPOSE_FILE=compose.yaml:infra/deploy/compose.yaml
export COMPOSE_ENV_FILES=/opt/clearcare/secrets/db.env,/opt/clearcare/secrets/object-storage.env
```

## Data

- Raw files: `/opt/clearcare/data/raw/sha256/<xx>/<sha256>`, read-only once written (ADR-0007).
- Manifests: `/opt/clearcare/data/manifests/register-snapshots.jsonl` and `inspection-reports.jsonl`, one JSON line per register or centre per run, including failed runs.
- `/opt/clearcare/data/schedule-state.json`: each job's last success and next attempt.

The directory belongs to uid 1001.

## Install or update

Every push to `main` that passes the checks runs `deploy.sh` on the VM ([ADR-0012](../../docs/adr/0012-main-deploys-to-the-vm-from-ci.md)). The script pulls `main` and hands over to the pulled copy of itself, so a change to the script applies in the deploy that brings it. It then builds the images, with `CLEARCARE_PIPELINE_VERSION` set to the commit, which the loaders store with each row, and runs `docker compose up -d`. To install, clone the repository to `/opt/clearcare/src` and create the data directory and the two settings files. To install or update by hand, for example after a failed run: `infra/deploy/deploy.sh <commit>`.

The first deploy with this file moves the pipeline off the systemd timer it ran under before: it builds the images while the timer still runs, turns the timer off, waits for the jobs the timer started, starts the services and only then removes the units. It needs the handover above, which #53 brings, so #53 must be deployed first. If that deploy stops after the timer is off, run `deploy.sh` again, or turn the timer back on with `sudo systemctl enable --now clearcare-register-snapshots.timer`.

The pipeline image changes with every commit, so a deploy recreates the pipeline container and stops a job that is running. Before each download the pipeline records the job's next attempt, a day after the attempt began, so a stopped download is not tried again before then. When the pipeline starts again, it uploads and loads what was stored. A restart during the first ingest of the stored reports is safe as well: the batches already written stay, and the next start skips the files they came from.

The workflow logs in with a key that can run nothing but the script. To set it up:

```sh
ssh-keygen -t ed25519 -N '' -C clearcare-deploy -f deploy_key
echo "command=\"/opt/clearcare/src/infra/deploy/deploy.sh\",restrict $(cat deploy_key.pub)" \
    >> ~/.ssh/authorized_keys    # on the VM
```

Then add three repository secrets: `DEPLOY_SSH_KEY` (the private key), `DEPLOY_HOST` (`ubuntu@<address>`) and `DEPLOY_KNOWN_HOSTS` (the output of `ssh-keyscan -t ed25519 <address>`).

The proxy needs a site block for the API. The hostname is not decided yet. Add the block to the proxy's Caddyfile, then run `caddy reload` in the proxy's container:

```
<hostname> {
    reverse_proxy clearcare-api:8080
}
```

## Check

```sh
docker compose ps -a
docker compose logs -f pipeline
cat /opt/clearcare/data/schedule-state.json
curl -i https://<hostname>/centres
```

`ps -a` shows `db`, `api` and `pipeline` running and `migrate` exited with code 0. The pipeline's log shows when each stage starts and ends, and its exit status. Until the register is loaded, the `curl` returns 503 with "The register has not been loaded yet." `ps -a` does not show whether the reports have loaded: the log does, in the summary line of `ingest_reports` (`parsed …, wrote …, already loaded …, skipped …, failed …`).

## Running a stage by hand

Stop the pipeline service first, so that the stage and the scheduler do not run at once, and start it again after. For example, to publish a register that lost more centres than the loader allows:

```sh
docker compose stop pipeline
docker compose run --rm pipeline clearcare_pipeline.load_register --data-dir /data --allow-shrink
docker compose start pipeline
```

`run` uses the pipeline service's user, settings and data directory. The other stages are `snapshots`, `upload`, `reports`, `load_report_files` and `ingest_reports`, each as `clearcare_pipeline.<stage>`.

## Loading the register

The loader publishes the newest successful snapshot of the register of centres, which is the snapshot the API serves. It checks the whole file before it writes anything. A file that fails a check is not loaded, and the log names the record, the column and what was expected, for example `register snapshot <sha256>: record 12, column County: expected one of the 26 counties, got 'Co. Kildare'`.

It also refuses to publish a snapshot in these cases, with a log line that starts with `refused:`:

- The published snapshot was downloaded later than this one. An older file never replaces a newer one.
- The register has more than 5 fewer centres than the published snapshot. If the centres really left, run the loader by hand with `--allow-shrink`, as above.
- This download is already in the database with another file.
- This download is already in the database but is not the published snapshot. This happens only after a rollback.

The stage then fails, and the API keeps serving the published snapshot. If the newest snapshot is already published, the loader logs `already loaded and published` and succeeds.

## Rolling back the register

The loader cannot change or delete what it loaded (ADR-0010), so rolling back is done by hand. Stop the pipeline first, or the next snapshot is published over the rollback: `docker compose stop pipeline`. Then, as the database owner, point `register_publication` at the previous `source_file`:

```sh
docker compose exec db psql -U postgres -d clearcare \
    -c "SET ROLE clearcare_owner" \
    -c "UPDATE clearcare.register_publication SET source_file_id = <id>, published_at = now()"
```

`docker compose start pipeline` turns the pipeline back on. The next deploy also starts it again.

## Start again from an empty database

```sh
docker compose down -v
infra/deploy/deploy.sh "$(git rev-parse HEAD)"
```

`down -v` deletes the volume and everything in it. The database holds only what the pipeline loads from the raw files (ADR-0007). When it starts again, the pipeline loads the newest register snapshot and the reports stored in `/opt/clearcare/data`; earlier register snapshots are not loaded again. There is no backup yet.
