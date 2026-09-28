# Register snapshots on the VM

HIQA overwrites its register of centres and its Section 64 register in place and keeps no history, so a systemd timer runs `python -m clearcare_pipeline.snapshots` once a day in a container (CCARE-17). If the VM was off at 06:00 UTC, the run happens at the next boot.

- Raw files: `/opt/clearcare/data/raw/sha256/<xx>/<sha256>` (read-only, ADR-0007)
- Manifest: `/opt/clearcare/data/manifests/register-snapshots.jsonl`, one JSON line per source per run, including failed runs

A run fails (and `systemctl` shows it as failed) if any source still fails after three attempts.

## Install or update

```sh
cd /opt/clearcare/src && git pull
docker build -t clearcare-pipeline:latest pipeline
sudo install -m 644 infra/systemd/clearcare-register-snapshots.service \
    infra/systemd/clearcare-register-snapshots.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clearcare-register-snapshots.timer
```

## Check

```sh
systemctl list-timers clearcare-register-snapshots.timer
journalctl -u clearcare-register-snapshots.service --since today
tail -n 2 /opt/clearcare/data/manifests/register-snapshots.jsonl
```

To take a snapshot now: `sudo systemctl start clearcare-register-snapshots.service`.
