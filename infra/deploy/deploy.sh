#!/bin/sh
# Updates the VM to a commit on main. The VM deploy workflow runs this over SSH
# with a key that can run nothing else, and passes the commit as the SSH
# command (ADR-0012). It does what the "Install or update" section of
# README.md describes. By hand: deploy.sh <commit>.
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
    # This function is the script from before the pull. Run the pulled script
    # once instead, so that a change to it applies in the deploy that brings it.
    if [ -z "${CLEARCARE_DEPLOY_PULLED:-}" ]; then
        export CLEARCARE_DEPLOY_PULLED=1
        exec infra/deploy/deploy.sh "$commit"
    fi
    echo "deploy: main is at $(git rev-parse --short HEAD)"

    export COMPOSE_FILE=compose.yaml:infra/deploy/compose.yaml
    export COMPOSE_ENV_FILES=/opt/clearcare/secrets/db.env,/opt/clearcare/secrets/object-storage.env
    CLEARCARE_PIPELINE_VERSION=$(git rev-parse --short HEAD)
    export CLEARCARE_PIPELINE_VERSION
    docker compose build --quiet

    # Once: the pipeline service replaces the systemd timer (ADR-0014). The
    # images are built while the timer still runs, its jobs finish before the
    # pipeline starts, and the units go after that, timer file last, so that a
    # deploy that fails halfway does this again.
    timer=/etc/systemd/system/clearcare-register-snapshots.timer
    if [ -e "$timer" ]; then
        sudo systemctl disable --now clearcare-register-snapshots.timer
        while systemctl list-jobs --no-legend 'clearcare-*' | grep -q .; do
            sleep 10
        done
    fi
    docker compose up -d --quiet-pull
    if [ -e "$timer" ]; then
        for unit in register-snapshots.service raw-upload.service \
            register-load.service register-snapshots.timer; do
            sudo rm -f "/etc/systemd/system/clearcare-$unit"
        done
        sudo systemctl daemon-reload
    fi
    docker compose ps -a
}

main "$@"
