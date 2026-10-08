# main deploys to the VM from the checks workflow

When the checks pass on a push to `main`, the workflow logs in to the VM over SSH and runs `infra/deploy/deploy.sh`, which pulls `main` and does what the install notes describe by hand: rebuild the API and pipeline images, apply new migrations and reinstall the systemd units. The key in the repository's secrets can run only that script on the VM, and the script deploys only commits that are on `main`.

Until now the VM was updated by hand after each merge, so the API fell behind `main` while the site on Vercel deploys on every merge. A timer on the VM that pulls `main` would need no key in the repository, but a failed update would show only in the VM's journal. Building images in the workflow and pulling them from a registry is more to run than the project needs.

Anything merged to `main` now reaches the public API within minutes, so `main` has to take only pull requests whose checks passed.
