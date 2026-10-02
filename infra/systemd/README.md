# Register snapshots on the VM

HIQA overwrites its register of centres and its Section 64 register in place and keeps no history, so a systemd timer runs `python -m clearcare_pipeline.snapshots` once a day in a container (CCARE-17). If the VM was off at 06:00 UTC, the run happens at the next boot.

- Raw files: `/opt/clearcare/data/raw/sha256/<xx>/<sha256>` (read-only, ADR-0007)
- Manifest: `/opt/clearcare/data/manifests/register-snapshots.jsonl`, one JSON line per source per run, including failed runs

A run fails (and `systemctl` shows it as failed) if any source still fails after three attempts.

After every snapshot run, successful or not, `clearcare-raw-upload.service` copies whatever the `clearcare-raw` bucket does not have yet: raw files under `raw/`, and each manifest line as its own object under `manifests/register-snapshots/`. The bucket's policy lets the upload credentials create and read objects but never overwrite or delete them, so the copy is write-once. A failed upload is retried by the next day's run.

The credentials are in `/opt/clearcare/secrets/object-storage.env` (mode 600, never in the repository), with `CLEARCARE_S3_ENDPOINT`, `CLEARCARE_S3_REGION`, `CLEARCARE_S3_BUCKET`, `CLEARCARE_S3_ACCESS_KEY_ID` and `CLEARCARE_S3_SECRET_ACCESS_KEY`.

## Install or update

```sh
cd /opt/clearcare/src && git pull
docker build -t clearcare-pipeline:latest pipeline
sudo install -m 644 infra/systemd/clearcare-register-snapshots.service \
    infra/systemd/clearcare-register-snapshots.timer \
    infra/systemd/clearcare-raw-upload.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clearcare-register-snapshots.timer
```

## Check

```sh
systemctl list-timers clearcare-register-snapshots.timer
journalctl -u clearcare-register-snapshots.service -u clearcare-raw-upload.service --since today
tail -n 2 /opt/clearcare/data/manifests/register-snapshots.jsonl
```

To take a snapshot now: `sudo systemctl start clearcare-register-snapshots.service`. To upload without a new snapshot: `sudo systemctl start clearcare-raw-upload.service`.

## Inspection reports

`python -m clearcare_pipeline.reports --county Dublin` downloads the inspection reports of one county's centres (CCARE-25). It takes the centres from the latest register snapshot and reads each centre's HIQA page for its list of reports. It is run by hand, not by a timer:

```sh
docker run --rm --user 1001:1001 --volume /opt/clearcare/data:/data \
    clearcare-pipeline:latest clearcare_pipeline.reports \
    --data-dir /data --county Dublin
```

- PDFs and centre pages go into the raw store above, so the upload service copies them to the bucket.
- Manifest: `/opt/clearcare/data/manifests/inspection-reports.jsonl`, one JSON line per centre per run. It lists each report on the centre page and the hash of its PDF.
- A PDF already in the manifest is not downloaded again. Requests are at least 3 seconds apart.
- Redirects are not followed. A network error, HTTP 429 or a 5xx response gets three attempts. Anything else that is not the expected page or PDF, such as a browser verification page or a redirect, stops the run at once.
