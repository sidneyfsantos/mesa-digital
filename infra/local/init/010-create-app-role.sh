#!/bin/sh
set -eu

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_user="$POSTGRES_APP_USER" \
  --set app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
select format(
  'create role %I login password %L nosuperuser nocreatedb nocreaterole noinherit nobypassrls',
  :'app_user',
  :'app_password'
) where not exists (
  select 1 from pg_roles where rolname = :'app_user'
) \gexec
SQL
