#!/bin/sh
# Installs PostGIS in a new local database, and nothing else, as on RDS
# (ADR-0026). compose.yaml mounts this over the postgis image's own
# 10_postgis.sh, which also installs postgis_topology, fuzzystrmatch and
# postgis_tiger_geocoder and creates a template_postgis database. RDS does not
# have those extensions, so a dump that names them fails to restore there.
#
# Keep this file executable. Docker Desktop's file sharing reports every
# mounted file as executable, so the entrypoint runs it rather than sourcing it.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c 'CREATE EXTENSION postgis'
