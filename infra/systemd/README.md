# Register snapshots on the VM

HIQA overwrites its register of centres and its Section 64 register in place and keeps no history, so a systemd timer runs `python -m clearcare_pipeline.snapshots` once a day in a container (CCARE-17). If the VM was off at 06:00 UTC, the run happens at the next boot.

- Raw files: `/opt/clearcare/data/raw/sha256/<xx>/<sha256>` (read-only, ADR-0007)
- Manifest: `/opt/clearcare/data/manifests/register-snapshots.jsonl`, one JSON line per source per run, including failed runs

A run fails (and `systemctl` shows it as failed) if any source still fails after three attempts.

After every snapshot run, successful or not, `clearcare-raw-upload.service` copies whatever the `clearcare-raw` bucket does not have yet: raw files under `raw/`, and each manifest line as its own object under `manifests/register-snapshots/` or `manifests/inspection-reports/`. The bucket's policy lets the upload credentials create and read objects but never overwrite or delete them, so the copy is write-once. A failed upload is retried by the next day's run.

The credentials are in `/opt/clearcare/secrets/object-storage.env` (mode 600, never in the repository), with `CLEARCARE_S3_ENDPOINT`, `CLEARCARE_S3_REGION`, `CLEARCARE_S3_BUCKET`, `CLEARCARE_S3_ACCESS_KEY_ID` and `CLEARCARE_S3_SECRET_ACCESS_KEY`.

## Install or update

```sh
cd /opt/clearcare/src && git pull
docker build -t clearcare-pipeline:latest \
    --build-arg CLEARCARE_PIPELINE_VERSION=$(git rev-parse --short HEAD) pipeline
sudo install -m 644 infra/systemd/clearcare-register-snapshots.service \
    infra/systemd/clearcare-register-snapshots.timer \
    infra/systemd/clearcare-raw-upload.service \
    infra/systemd/clearcare-register-load.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clearcare-register-snapshots.timer
```

## Check

```sh
systemctl list-timers clearcare-register-snapshots.timer
journalctl -u clearcare-register-snapshots.service -u clearcare-raw-upload.service \
    -u clearcare-register-load.service --since today
tail -n 2 /opt/clearcare/data/manifests/register-snapshots.jsonl
```

To take a snapshot now: `sudo systemctl start clearcare-register-snapshots.service`. To upload without a new snapshot: `sudo systemctl start clearcare-raw-upload.service`.

## Loading the register into the database

After every snapshot run, successful or not, `clearcare-register-load.service` runs `python -m clearcare_pipeline.load_register` (CCARE-31). It loads the newest successful snapshot of the register of centres into PostgreSQL and publishes it, which is the snapshot the API serves. Snapshots that were never loaded are not loaded later.

The loader logs in as `clearcare_pipeline` with the settings in `/opt/clearcare/secrets/pipeline-db.env` (mode 600, never in the repository). The password is `CLEARCARE_PIPELINE_PASSWORD` from `db.env` ([infra/deploy/README.md](../deploy/README.md)):

```
PGHOST=clearcare-db
PGPORT=5432
PGDATABASE=clearcare
PGUSER=clearcare_pipeline
PGPASSWORD=<CLEARCARE_PIPELINE_PASSWORD>
```

`CLEARCARE_PIPELINE_VERSION` is not in this file. The image sets it to the commit it was built from, and the loader stores it with each row.

To load now: `sudo systemctl start clearcare-register-load.service`. To run it by hand with an option:

```sh
docker run --rm --user 1001:1001 --network clearcare_default \
    --env-file /opt/clearcare/secrets/pipeline-db.env \
    --volume /opt/clearcare/data:/data:ro \
    clearcare-pipeline:latest clearcare_pipeline.load_register \
    --data-dir /data --allow-shrink
```

The loader checks the whole file before it writes anything. A file that fails a check is not loaded, and the log names the record, the column and what was expected, for example `register snapshot <sha256>: record 12, column County: expected one of the 26 counties, got 'Co. Kildare'`.

It also refuses to publish a snapshot in these cases, with a log line that starts with `refused:`:

- The published snapshot was downloaded later than this one. An older file never replaces a newer one.
- The register has more than 5 fewer centres than the published snapshot. If the centres really left, run the loader by hand with `--allow-shrink`.
- This download is already in the database with another file.
- This download is already in the database but is not the published snapshot. This happens only after a rollback.

The run then fails, and the API keeps serving the published snapshot. If the newest snapshot is already published, the loader logs `already loaded and published` and succeeds.

The loader cannot change or delete what it loaded (ADR-0010), so rolling back is done by hand. Mask the loader first, or the next snapshot is published over the rollback: `sudo systemctl mask clearcare-register-load.service`. Then, as the database owner, point `register_publication` at the previous `source_file`:

```sh
docker compose -f infra/deploy/compose.yaml exec db psql -U postgres -d clearcare \
    -c "SET ROLE clearcare_owner" \
    -c "UPDATE clearcare.register_publication SET source_file_id = <id>, published_at = now()"
```

`sudo systemctl unmask clearcare-register-load.service` turns the loader back on.

## Inspection reports

`python -m clearcare_pipeline.reports --county Dublin` downloads the inspection reports of one county's centres (CCARE-25). It takes the centres from the latest register snapshot and reads each centre's HIQA page for its list of reports. It is run by hand, not by a timer:

```sh
docker run --rm --user 1001:1001 --volume /opt/clearcare/data:/data \
    clearcare-pipeline:latest clearcare_pipeline.reports \
    --data-dir /data --county Dublin
```

- PDFs and centre pages go into the raw store above.
- Manifest: `/opt/clearcare/data/manifests/inspection-reports.jsonl`, one JSON line per centre per run. It lists each report on the centre page and the hash of its PDF.
- The upload service copies the files and the manifest to the bucket the next time it runs.
- A PDF already in the manifest is not downloaded again. Requests are at least 3 seconds apart.
- Redirects are not followed. A network error, HTTP 429 or a 5xx response gets three attempts. Anything else that is not the expected page or PDF, such as a browser verification page or a redirect, stops the run at once.
