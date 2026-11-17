#!/bin/sh
# Runs Flyway under the lock a pipeline run also takes (ADR-0022), so that a
# migration cannot run while a run is writing to the database.
#
# Flyway cannot hold a session-level advisory lock of its own for the length
# of a migration, so this script holds one on a psql session and runs Flyway
# inside it. That session must be *idle* while Flyway works: a backend inside
# a query only notices that its client has gone when the query returns, so a
# lock held during a long sleep would outlive the task by up to a day, and
# every run and migration in that time would wait or skip. Here psql waits at
# its prompt, and the server ends it as soon as the pipe it reads closes,
# including when the client is killed.
#
# psql failing to hold the lock (bad credentials, no route, a certificate it
# cannot verify) fails the task: a migration that ran without the lock would
# be the thing the lock exists to prevent.
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
# script takes them from the FLYWAY_* ones, TLS included: the task definition
# needs nothing that Flyway itself does not already use.

set -eu

# psql's own settings, from Flyway's when the task does not set them. The URL
# is jdbc:postgresql://host[:port]/database[?sslmode=...&sslrootcert=...].
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
  case $FLYWAY_URL in
    *\?*)
      # psql does not read a JDBC URL. The TLS settings in its query string
      # are passed on, so a migration never quietly verifies less than the
      # other clients do.
      old_ifs=$IFS
      IFS='&'
      for pair in ${FLYWAY_URL#*\?}; do
        case ${pair%%=*} in
          sslmode)
            if [ -z "${PGSSLMODE:-}" ]; then
              PGSSLMODE=${pair#*=}
              export PGSSLMODE
            fi
            ;;
          sslrootcert)
            if [ -z "${PGSSLROOTCERT:-}" ]; then
              PGSSLROOTCERT=${pair#*=}
              export PGSSLROOTCERT
            fi
            ;;
        esac
      done
      IFS=$old_ifs
      ;;
  esac
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
fifo=
status=
holder=
# Whether this shell still holds the pipe's write end; closing it ends psql.
writer_open=no

release() {
  if [ "$writer_open" = yes ]; then
    exec 3>&- || true
    writer_open=no
  fi
  if [ -n "$holder" ]; then
    kill "$holder" 2>/dev/null || true
    wait "$holder" 2>/dev/null || true
  fi
  [ -z "$fifo" ] || rm -f "$fifo"
  [ -z "$status" ] || rm -f "$status"
}
trap release EXIT
trap 'exit 143' INT TERM
# Writing into a pipe whose reader has gone is not worth dying for: the wait
# loop below reports that properly, with psql's own message.
trap '' PIPE

wait_for_the_lock() {
  # Fail here, with a message about the connection, rather than half-opening
  # the pipe because psql never managed to connect.
  # psql's own message is the useful one, so it goes to the task log as it is.
  if ! psql -X -q -A -t -c 'SELECT 1' >/dev/null; then
    echo "migrate: psql cannot reach the database (above)" >&2
    exit 1
  fi
  fifo=$(mktemp -u)
  status=$(mktemp)
  mkfifo "$fifo"
  # -o /dev/null: query output goes nowhere, so only \echo reaches psql's
  # stdout. Reading commands from the pipe leaves psql at its prompt between
  # them, which is what lets the session end as soon as the pipe closes.
  PGAPPNAME=$application_name psql -X -q -A -t -o /dev/null -f - \
    <"$fifo" >"$status" 2>&1 &
  holder=$!
  exec 3>"$fifo"
  writer_open=yes
  printf 'SELECT pg_advisory_lock(%s);\n\\echo locked\n' "$lock_key" >&3
  while ! grep -qx locked "$status" 2>/dev/null; do
    if ! kill -0 "$holder" 2>/dev/null; then
      echo "migrate: psql could not hold the run lock ($lock_key)" >&2
      cat "$status" >&2 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "migrate: holding the run lock ($lock_key)"
}

if [ "${1:-migrate}" = migrate ]; then
  wait_for_the_lock
fi

flyway "$@"
