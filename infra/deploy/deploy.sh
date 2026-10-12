#!/bin/sh
# Updates the VM to a commit on main. The checks workflow runs this over SSH
# with a key that can run nothing else, and passes the commit as the SSH
# command (ADR-0012). It does what the "Install or update" sections of
# README.md and ../systemd/README.md describe. By hand: deploy.sh <commit>.
#
# The body is a function so that the shell has read the whole file before
# git pull replaces it.
set -eu

main() {
    commit=${SSH_ORIGINAL_COMMAND:-${1:-}}
    case $commit in
        *[!0-9a-f]* | '')
            echo "deploy: expected a commit hash, got '$commit'" >&2
            exit 2
            ;;
    esac

    cd /opt/clearcare/src
    git fetch --quiet origin main
    git checkout --quiet main
    git merge --quiet --ff-only origin/main
    if ! git merge-base --is-ancestor "$commit" HEAD; then
        echo "deploy: $commit is not on main" >&2
        exit 1
    fi
    echo "deploy: main is at $(git rev-parse --short HEAD)"

    docker compose -f infra/deploy/compose.yaml up -d --build --quiet-pull
    docker build --quiet -t clearcare-pipeline:latest \
        --build-arg CLEARCARE_PIPELINE_VERSION="$(git rev-parse --short HEAD)" pipeline
    sudo install -m 644 infra/systemd/clearcare-register-snapshots.service \
        infra/systemd/clearcare-register-snapshots.timer \
        infra/systemd/clearcare-raw-upload.service \
        infra/systemd/clearcare-register-load.service /etc/systemd/system/
    sudo systemctl daemon-reload

    docker compose -f infra/deploy/compose.yaml ps -a
}

main "$@"
