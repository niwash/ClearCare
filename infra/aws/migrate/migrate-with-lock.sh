#!/bin/sh
# Runs Flyway under the lock a pipeline run also takes (ADR-0021), so that a
# migration cannot run while a run is writing to the database.
#
# Flyway cannot hold a session-level advisory lock of its own for the length
# of a migration, so this script holds one on a psql session and runs Flyway
# inside it. psql failing to hold the lock (bad credentials, no route to the
# database) fails the task: a migration that ran without the lock would be
# the thing the lock exists to prevent.
#
# Usage: migrate-with-lock.sh [migrate|info|validate|...]
#
#   migrate  the default: waits for the lock, then runs flyway migrate.
#   other    passed to Flyway as it is, without the lock. Those commands only
#            read, and waiting for a crawl to finish to run `info` is not
#            worth it.
#
# The connection is the task's FLYWAY_URL, FLYWAY_USER and FLYWAY_PASSWORD.
# psql reads libpq's PG* variables instead, so when those are not set the
# script takes them from the FLYWAY_* ones: the task definition needs nothing
# that Flyway itself does not already use.

set -eu

# psql's own settings, from Flyway's when the task does not set them. The URL
# is jdbc:postgresql://host[:port]/database[?options].
if [ -z "${PGHOST:-}" ] && [ -n "${FLYWAY_URL:-}" ]; then
  endpoint=${FLYWAY_URL#jdbc:postgresql://}
  database=${endpoint#*/}
  endpoint=${endpoint%%/*}
  PGHOST=${endpoint%%:*}
  case $endpoint in
    *:*) PGPORT=${endpoint##*:} ;;
  esac
  PGDATABASE=${database%%\?*}
  export PGHOST PGDATABASE
  if [ -n "${PGPORT:-}" ]; then export PGPORT; fi
fi
if [ -z "${PGUSER:-}" ] && [ -n "${FLYWAY_USER:-}" ]; then
  PGUSER=$FLYWAY_USER
  export PGUSER
fi
if [ -z "${PGPASSWORD:-}" ] && [ -n "${FLYWAY_PASSWORD:-}" ]; then
  PGPASSWORD=$FLYWAY_PASSWORD
  export PGPASSWORD
fi

lock_key=149
application_name=clearcare-migrate-lock
holder=

release() {
  if [ -n "$holder" ]; then
    kill "$holder" 2>/dev/null || true
    wait "$holder" 2>/dev/null || true
  fi
}
trap release EXIT
trap 'exit 143' INT TERM

holds_the_lock() {
  # A lock another session holds is granted to nobody, so the lock is this
  # script's only when its own psql session is listed with it.
  psql -X -q -A -t -c "
    SELECT 1
    FROM pg_locks held
    JOIN pg_stat_activity session ON session.pid = held.pid
    WHERE held.locktype = 'advisory'
      AND held.granted
      AND session.application_name = '$application_name'
  " | grep -q 1
}

wait_for_the_lock() {
  # Blocks inside pg_advisory_lock until the pipeline run that holds the lock
  # ends, then sleeps, which is what keeps its session, and the lock, open.
  PGAPPNAME=$application_name psql -X -q -A -t \
    -c "SELECT pg_advisory_lock($lock_key); SELECT pg_sleep(86400)" \
    >/dev/null 2>&1 &
  holder=$!
  until holds_the_lock; do
    if ! kill -0 "$holder" 2>/dev/null; then
      echo "migrate: psql could not hold the run lock ($lock_key)" >&2
      exit 1
    fi
    sleep 2
  done
  echo "migrate: holding the run lock ($lock_key)"
}

if [ "${1:-migrate}" = migrate ]; then
  wait_for_the_lock
fi

flyway "$@"
