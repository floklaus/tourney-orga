#!/usr/bin/env bash
#
# coolify.sh — manage the Tourney Orga deployment on Coolify (v4 REST API, tested
# against 4.1.2).
#
# One Coolify project holds three resources:
#   - database : managed PostgreSQL (Coolify backups, independent lifecycle)
#   - backend  : Dockerfile build of backend/  (NestJS API, port 3001)
#   - frontend : Dockerfile build of frontend/ (Next.js, port 3000)
#
# Both apps build from GitHub through the Coolify GitHub App (COOLIFY_GITHUB_APP_NAME)
# with auto-deploy on: a push to the branch redeploys the app whose folder changed
# (watch paths backend/** and frontend/**).
#
# The frontend proxies /api to the backend over Coolify's internal network
# (network alias, see COOLIFY_API_ALIAS), so the browser only talks to the UI
# domain and cookies stay first-party. The API domain is public for one-click
# unsubscribe links. The backend runs pending migrations on start.
#
# Config and secrets come from a gitignored env file (default:
# deploy/.env.coolify; copy deploy/.env.coolify.example). No secret is printed.
#
# Usage:
#   ./deploy/coolify.sh init                            # create everything + deploy
#   ./deploy/coolify.sh update [backend|frontend|all]   # push config + redeploy
#   ./deploy/coolify.sh reset  [--yes]                  # wipe the database, redeploy backend
#   ./deploy/coolify.sh teardown [--yes]                # delete apps, database, project
#   ./deploy/coolify.sh status                          # show resources + health
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${COOLIFY_ENV_FILE:-$SCRIPT_DIR/.env.coolify}"
STATE_FILE="$SCRIPT_DIR/.coolify-state"
DEPLOY_TIMEOUT_SECONDS="${DEPLOY_TIMEOUT_SECONDS:-1500}"
POLL_SECONDS="${POLL_SECONDS:-10}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"

die() { echo "error: $*" >&2; exit 1; }
info() { echo ">> $*" >&2; }

# --- configuration ----------------------------------------------------------
load_env() {
  [ -f "$ENV_FILE" ] || die "missing $ENV_FILE (copy deploy/.env.coolify.example and fill it in)"
  # Everything below (the env file and the defaults) is exported for the python helpers.
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  command -v curl >/dev/null 2>&1 || die "curl is required"
  command -v python3 >/dev/null 2>&1 || die "python3 is required"
  : "${COOLIFY_BASE_URL:?set COOLIFY_BASE_URL in $ENV_FILE}"
  : "${COOLIFY_API_TOKEN:?set COOLIFY_API_TOKEN in $ENV_FILE}"

  : "${COOLIFY_PROJECT_NAME:=tourney-orga}"
  : "${COOLIFY_ENVIRONMENT_NAME:=production}"
  : "${COOLIFY_GIT_REPOSITORY:=floklaus/tourney-orga}"
  : "${COOLIFY_GIT_BRANCH:=main}"
  # GitHub App registered in Coolify (Sources); it delivers the push webhooks.
  : "${COOLIFY_GITHUB_APP_NAME:=tourney-orga}"

  : "${APP_DOMAIN:=tourney-orga.challenge-limits.com}"
  : "${API_DOMAIN:=tourney-orga-api.challenge-limits.com}"

  : "${COOLIFY_DB_NAME:=tourney-orga-db}"
  : "${COOLIFY_DB_IMAGE:=postgres:16-alpine}"
  : "${POSTGRES_USER:=tourney_orga}"
  : "${POSTGRES_DB:=tourney_orga}"
  : "${DB_BACKUP_FREQUENCY:=daily}"
  : "${DB_BACKUP_KEEP:=14}"

  : "${COOLIFY_API_APP_NAME:=tourney-orga-api}"
  : "${COOLIFY_WEB_APP_NAME:=tourney-orga-web}"
  : "${COOLIFY_API_ALIAS:=tourney-orga-api}"   # internal hostname of the backend

  # Derived backend settings (override in the env file only if you know why).
  : "${APP_URL:=https://$APP_DOMAIN}"
  : "${API_PUBLIC_URL:=https://$API_DOMAIN}"
  : "${NODE_ENV:=production}"
  : "${COOKIE_SECURE:=true}"
  : "${RUN_MIGRATIONS:=true}"
  # Coolify's proxy -> web -> api (X-Forwarded-For passed on) or proxy -> api: one trusted hop.
  : "${TRUST_PROXY_HOPS:=1}"
  : "${MAIL_AUTH_MODE:=NONE}"
  # The frontend's /api rewrite target is baked in at build time.
  # shellcheck disable=SC2034 # exported via set -a
  API_URL="http://${COOLIFY_API_ALIAS}:3001"
  set +a
}

# Runtime env of the backend. Keys without a value are not pushed.
BACKEND_ENV_KEYS="NODE_ENV DATABASE_URL JWT_SECRET APP_URL API_PUBLIC_URL COOKIE_SECURE TRUST_PROXY_HOPS RUN_MIGRATIONS
  ADMIN_EMAIL ADMIN_PASSWORD ADMIN_FIRST_NAME ADMIN_LAST_NAME
  MAIL_AUTH_MODE MAIL_USER GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN MAIL_APP_PASSWORD SMTP_HOST SMTP_PORT"
FRONTEND_ENV_KEYS="API_URL"

# Generates missing secrets once and stores them in the env file (never printed).
ensure_secrets() {
  local key len
  for pair in POSTGRES_PASSWORD:32 JWT_SECRET:48 ADMIN_PASSWORD:20; do
    key="${pair%%:*}"; len="${pair##*:}"
    if [ -z "${!key:-}" ]; then
      local value; value="$(python3 -c "import secrets,sys; print(secrets.token_urlsafe(int(sys.argv[1])))" "$len")"
      printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
      export "$key=$value"
      info "generated $key and saved it in $(basename "$ENV_FILE")"
    fi
  done
}

require_config() {
  : "${COOLIFY_SERVER_UUID:?set COOLIFY_SERVER_UUID in $ENV_FILE}"
  : "${ADMIN_EMAIL:?set ADMIN_EMAIL in $ENV_FILE (the first admin login)}"
}

# --- HTTP -------------------------------------------------------------------
api() { # METHOD PATH [JSON_BODY] -> sets RESP_BODY, RESP_CODE
  local method="$1" path="$2" body="${3:-}"
  local url="${COOLIFY_BASE_URL%/}/api/v1${path}"
  local args=(-sS -X "$method" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" -H "Accept: application/json")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" --data-binary "$body")
  local raw; raw="$(curl "${args[@]}" -w $'\n%{http_code}' "$url")"
  RESP_CODE="${raw##*$'\n'}"; RESP_BODY="${raw%$'\n'*}"
}
api_ok() { api "$@"; case "$RESP_CODE" in 2*) ;; *) die "Coolify API $1 $2 failed (HTTP $RESP_CODE): $RESP_BODY" ;; esac; }

json_field() { # KEY: prints a top-level (or .data) field of RESP_BODY
  printf '%s' "$RESP_BODY" | KEY="$1" python3 -c '
import sys, json, os
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
if isinstance(d, dict):
    v = d.get(os.environ["KEY"])
    if v is None and isinstance(d.get("data"), dict): v = d["data"].get(os.environ["KEY"])
    if v is not None: print(v)
'
}

find_uuid_by_name() { # LIST_PATH NAME
  api_ok GET "$1"
  printf '%s' "$RESP_BODY" | NAME="$2" python3 -c '
import sys, json, os
d = json.load(sys.stdin)
for it in (d if isinstance(d, list) else d.get("data", [])):
    if it.get("name") == os.environ["NAME"]: print(it.get("uuid", "")); break
'
}

json_obj() { # key=value ... (values from env when given as key=@VAR) -> JSON object
  python3 - "$@" <<'PY'
import json, os, sys
out = {}
for arg in sys.argv[1:]:
    k, v = arg.split("=", 1)
    if v.startswith("@"): v = os.environ.get(v[1:], "")
    if v in ("true", "false"): v = v == "true"
    out[k] = v
print(json.dumps(out))
PY
}

# --- state (gitignored) -----------------------------------------------------
state_set() { touch "$STATE_FILE"; grep -v "^$1=" "$STATE_FILE" > "$STATE_FILE.tmp" || true; echo "$1=$2" >> "$STATE_FILE.tmp"; mv "$STATE_FILE.tmp" "$STATE_FILE"; }
state_get() { [ -f "$STATE_FILE" ] && (grep "^$1=" "$STATE_FILE" | tail -1 | cut -d= -f2-) || true; }
state_clear() { [ -f "$STATE_FILE" ] || return 0; grep -v "^$1=" "$STATE_FILE" > "$STATE_FILE.tmp" || true; mv "$STATE_FILE.tmp" "$STATE_FILE"; }

# Resolves a resource by saved uuid (if it still exists) or by name.
resolve() { # STATE_KEY LIST_PATH NAME
  local uuid; uuid="$(state_get "$1")"
  if [ -n "$uuid" ]; then
    api GET "$2/$uuid"
    [ "${RESP_CODE:0:1}" = 2 ] || { state_clear "$1"; uuid=""; }
  fi
  [ -n "$uuid" ] || uuid="$(find_uuid_by_name "$2" "$3")"
  [ -z "$uuid" ] || state_set "$1" "$uuid"
  printf '%s' "$uuid"
}

# --- project ----------------------------------------------------------------
ensure_project() {
  PROJECT_UUID="$(resolve PROJECT_UUID /projects "$COOLIFY_PROJECT_NAME")"
  if [ -z "$PROJECT_UUID" ]; then
    info "creating project '$COOLIFY_PROJECT_NAME'"
    api_ok POST /projects "$(json_obj name=@COOLIFY_PROJECT_NAME "description=Tournament team communication")"
    PROJECT_UUID="$(json_field uuid)"; [ -n "$PROJECT_UUID" ] || die "no project uuid in: $RESP_BODY"
    state_set PROJECT_UUID "$PROJECT_UUID"
  else
    info "project '$COOLIFY_PROJECT_NAME' exists ($PROJECT_UUID)"
  fi
  export PROJECT_UUID
}

# --- database ---------------------------------------------------------------
database_url() { # HOST
  DB_HOST="$1" python3 <<'PY'
import os, urllib.parse as u
q = lambda k: u.quote(os.environ[k], safe="")
print(f"postgres://{q('POSTGRES_USER')}:{q('POSTGRES_PASSWORD')}@{os.environ['DB_HOST']}:5432/{q('POSTGRES_DB')}")
PY
}

ensure_database() {
  DB_UUID="$(resolve DB_UUID /databases "$COOLIFY_DB_NAME")"
  if [ -z "$DB_UUID" ]; then
    info "creating managed PostgreSQL '$COOLIFY_DB_NAME'"
    api_ok POST /databases/postgresql "$(json_obj project_uuid=@PROJECT_UUID server_uuid=@COOLIFY_SERVER_UUID \
      environment_name=@COOLIFY_ENVIRONMENT_NAME name=@COOLIFY_DB_NAME image=@COOLIFY_DB_IMAGE \
      postgres_user=@POSTGRES_USER postgres_password=@POSTGRES_PASSWORD postgres_db=@POSTGRES_DB \
      is_public=false instant_deploy=true)"
    DB_UUID="$(json_field uuid)"; [ -n "$DB_UUID" ] || die "no database uuid in: $RESP_BODY"
    state_set DB_UUID "$DB_UUID"
    ensure_backups
  else
    info "database '$COOLIFY_DB_NAME' exists ($DB_UUID)"
    api GET "/databases/$DB_UUID/start" # no-op when running
  fi
  # Standalone databases are reachable on Coolify's network by their uuid.
  DATABASE_URL="$(database_url "$DB_UUID")"; export DATABASE_URL
}

ensure_backups() {
  api GET "/databases/$DB_UUID/backups"
  if [ "${RESP_CODE:0:1}" = 2 ] && [ "$RESP_BODY" != "[]" ]; then return 0; fi
  info "scheduling $DB_BACKUP_FREQUENCY database backups (keeping $DB_BACKUP_KEEP)"
  api POST "/databases/$DB_UUID/backups" "$(python3 -c '
import json, os
print(json.dumps({"frequency": os.environ["DB_BACKUP_FREQUENCY"], "enabled": True,
  "database_backup_retention_amount_locally": int(os.environ["DB_BACKUP_KEEP"])}))')"
  [ "${RESP_CODE:0:1}" = 2 ] || info "warning: could not schedule backups (HTTP $RESP_CODE); set them up in Coolify"
}

# Deletes a resource and waits until Coolify has removed it.
delete_and_wait() { # LIST_PATH UUID LABEL
  info "deleting $3 $2 (including volumes)"
  api DELETE "$1/$2?delete_configurations=true&delete_volumes=true&docker_cleanup=true&delete_connected_networks=true"
  case "$RESP_CODE" in 2*|404) ;; *) die "deleting $3 failed (HTTP $RESP_CODE): $RESP_BODY" ;; esac
  local waited=0
  while api GET "$1/$2"; [ "${RESP_CODE:0:1}" = 2 ]; do
    [ "$waited" -lt 300 ] || die "$3 $2 still exists after 5 minutes"
    sleep 5; waited=$((waited + 5))
  done
}

# --- GitHub App (source of both apps) ---------------------------------------
resolve_github_app() {
  [ -z "${GITHUB_APP_UUID:-}" ] || return 0
  api_ok GET /github-apps
  local found; found="$(printf '%s' "$RESP_BODY" | NAME="$COOLIFY_GITHUB_APP_NAME" python3 -c '
import sys, json, os
d = json.load(sys.stdin)
for g in (d if isinstance(d, list) else d.get("data", [])):
    if g.get("name") == os.environ["NAME"]: print(g.get("uuid", ""), g.get("id", "")); break
')"
  [ -n "$found" ] || die "GitHub App '$COOLIFY_GITHUB_APP_NAME' not found in Coolify (Sources); set COOLIFY_GITHUB_APP_NAME"
  GITHUB_APP_UUID="${found% *}"; GITHUB_APP_ID="${found#* }"
  export GITHUB_APP_UUID GITHUB_APP_ID
  info "building from GitHub App '$COOLIFY_GITHUB_APP_NAME' (auto-deploy on push to $COOLIFY_GIT_BRANCH)"
}

# True when the app pulls through our GitHub App (Coolify's API cannot switch an app's source).
uses_github_app() { # APP_UUID
  api_ok GET "/applications/$1"
  # "Public GitHub" is a GitHub source too (id 0), so the id decides.
  [ "$(json_field source_id)" = "$GITHUB_APP_ID" ]
}

# --- applications -----------------------------------------------------------
app_settings() { # KIND -> JSON for fields this script owns (sent on create and update)
  APP_KIND="$1" python3 <<'PY'
import json, os
backend = os.environ["APP_KIND"] == "backend"
print(json.dumps({
    "domains": "https://" + os.environ["API_DOMAIN" if backend else "APP_DOMAIN"],
    "ports_exposes": "3001" if backend else "3000",
    "base_directory": "/backend" if backend else "/frontend",
    "dockerfile_location": "/Dockerfile",
    # Push webhooks only redeploy the app whose folder changed.
    "watch_paths": "backend/**" if backend else "frontend/**",
    "is_auto_deploy_enabled": True,
    **({"custom_network_aliases": os.environ["COOLIFY_API_ALIAS"]} if backend else {}),
}))
PY
}

create_body() { # KIND
  APP_KIND="$1" SETTINGS="$(app_settings "$1")" python3 <<'PY'
import json, os
body = json.loads(os.environ["SETTINGS"])
body.update({
    "project_uuid": os.environ["PROJECT_UUID"],
    "server_uuid": os.environ["COOLIFY_SERVER_UUID"],
    "environment_name": os.environ["COOLIFY_ENVIRONMENT_NAME"],
    "git_repository": os.environ["COOLIFY_GIT_REPOSITORY"],
    "git_branch": os.environ["COOLIFY_GIT_BRANCH"],
    "github_app_uuid": os.environ["GITHUB_APP_UUID"],
    "build_pack": "dockerfile",
    "name": os.environ["COOLIFY_API_APP_NAME" if os.environ["APP_KIND"] == "backend" else "COOLIFY_WEB_APP_NAME"],
    "instant_deploy": False,
})
print(json.dumps(body))
PY
}

ensure_app() { # KIND STATE_KEY NAME -> prints uuid
  local kind="$1" key="$2" name="$3" uuid
  resolve_github_app
  uuid="$(resolve "$key" /applications "$name")"
  if [ -n "$uuid" ] && ! uses_github_app "$uuid"; then
    # Created before the GitHub App existed: recreate it (the database is not touched).
    info "$kind app '$name' does not build from the GitHub App; recreating it"
    delete_and_wait /applications "$uuid" "$kind app"
    state_clear "$key"; uuid=""
  fi
  if [ -z "$uuid" ]; then
    info "creating $kind app '$name'"
    api_ok POST /applications/private-github-app "$(create_body "$kind")"
    uuid="$(json_field uuid)"; [ -n "$uuid" ] || die "no $kind app uuid in: $RESP_BODY"
    state_set "$key" "$uuid"
  else
    info "$kind app '$name' exists ($uuid); updating its settings"
    api_ok PATCH "/applications/$uuid" "$(app_settings "$kind")"
  fi
  printf '%s' "$uuid"
}

push_envs() { # APP_UUID BUILDTIME KEYS...
  local app="$1" buildtime="$2"; shift 2
  local body; body="$(BUILDTIME="$buildtime" python3 - "$@" <<'PY'
import json, os, sys
bt = os.environ["BUILDTIME"] == "true"
data = [{"key": k, "value": os.environ[k], "is_literal": True, "is_buildtime": bt, "is_runtime": True}
        for k in sys.argv[1:] if os.environ.get(k)]
print(json.dumps({"data": data}))
PY
)"
  info "pushing environment ($(printf '%s' "$body" | python3 -c 'import json,sys; print(", ".join(d["key"] for d in json.load(sys.stdin)["data"]))'))"
  api_ok PATCH "/applications/$app/envs/bulk" "$body"
}

# Starts a deployment and waits for it to finish.
deploy_and_wait() { # APP_UUID LABEL
  api_ok GET "/applications/$1/start"
  local deployment; deployment="$(json_field deployment_uuid)"
  [ -n "$deployment" ] || { info "$2 deployment queued (no deployment id returned)"; return 0; }
  info "$2 deployment started ($deployment); waiting (logs in Coolify)"
  local waited=0 status=""
  while [ "$waited" -lt "$DEPLOY_TIMEOUT_SECONDS" ]; do
    sleep "$POLL_SECONDS"; waited=$((waited + POLL_SECONDS))
    api GET "/deployments/$deployment"
    status="$(json_field status)"
    case "$status" in
      finished) info "$2 deployed after ${waited}s"; return 0 ;;
      failed|cancelled*) die "$2 deployment $status (see the deployment log in Coolify)" ;;
    esac
  done
  die "$2 deployment still '$status' after ${DEPLOY_TIMEOUT_SECONDS}s"
}

wait_healthy() { # URL LABEL
  local waited=0
  until curl -sf -o /dev/null --max-time 10 "$1"; do
    [ "$waited" -lt "$HEALTH_TIMEOUT_SECONDS" ] || { info "warning: $2 not reachable at $1 yet (DNS/certificate may still be pending)"; return 0; }
    sleep 10; waited=$((waited + 10))
  done
  info "$2 is up: $1"
}

do_backend() {
  ensure_database
  local app; app="$(ensure_app backend BACKEND_APP_UUID "$COOLIFY_API_APP_NAME")"
  # shellcheck disable=SC2086
  push_envs "$app" false $BACKEND_ENV_KEYS
  deploy_and_wait "$app" backend
  wait_healthy "https://$API_DOMAIN/api/v1/health" API
}

do_frontend() {
  local app; app="$(ensure_app frontend FRONTEND_APP_UUID "$COOLIFY_WEB_APP_NAME")"
  # shellcheck disable=SC2086
  push_envs "$app" true $FRONTEND_ENV_KEYS
  deploy_and_wait "$app" frontend
  wait_healthy "https://$APP_DOMAIN/login" UI
}

confirm() { # MESSAGE
  [ "$ASSUME_YES" = true ] && return 0
  [ -t 0 ] || die "refusing without a terminal; re-run with --yes"
  echo "$1" >&2
  local answer; read -r -p "Type the project name ($COOLIFY_PROJECT_NAME) to continue: " answer
  [ "$answer" = "$COOLIFY_PROJECT_NAME" ] || die "aborted"
}

# --- commands ---------------------------------------------------------------
cmd_init() {
  require_config; ensure_secrets
  ensure_project
  do_backend
  do_frontend
  info "init complete: https://$APP_DOMAIN (log in as $ADMIN_EMAIL; the password is ADMIN_PASSWORD in $(basename "$ENV_FILE"))"
}

cmd_update() {
  require_config; ensure_secrets
  ensure_project
  case "$TARGET" in
    backend) do_backend ;;
    frontend) do_frontend ;;
    all) do_backend; do_frontend ;;
  esac
  info "update complete"
}

cmd_reset() {
  require_config
  confirm "This deletes the database '$COOLIFY_DB_NAME' with ALL its data and its backup schedule, then starts from an empty database."
  ensure_project
  local db; db="$(resolve DB_UUID /databases "$COOLIFY_DB_NAME")"
  if [ -n "$db" ]; then delete_and_wait /databases "$db" database; state_clear DB_UUID; fi
  do_backend # new database, new DATABASE_URL, migrations + first admin on start
  info "reset complete: log in as $ADMIN_EMAIL"
}

cmd_teardown() {
  confirm "This deletes the apps, the database with ALL its data, and the project '$COOLIFY_PROJECT_NAME'."
  local uuid
  uuid="$(resolve FRONTEND_APP_UUID /applications "$COOLIFY_WEB_APP_NAME")"; [ -z "$uuid" ] || delete_and_wait /applications "$uuid" "frontend app"
  uuid="$(resolve BACKEND_APP_UUID /applications "$COOLIFY_API_APP_NAME")"; [ -z "$uuid" ] || delete_and_wait /applications "$uuid" "backend app"
  uuid="$(resolve DB_UUID /databases "$COOLIFY_DB_NAME")"; [ -z "$uuid" ] || delete_and_wait /databases "$uuid" database
  uuid="$(resolve PROJECT_UUID /projects "$COOLIFY_PROJECT_NAME")"
  if [ -n "$uuid" ]; then
    info "deleting project $uuid"
    api DELETE "/projects/$uuid"
    case "$RESP_CODE" in 2*|404) ;; *) die "deleting the project failed (HTTP $RESP_CODE): $RESP_BODY" ;; esac
  fi
  rm -f "$STATE_FILE"
  info "teardown complete (secrets in $(basename "$ENV_FILE") are kept)"
}

cmd_status() {
  api_ok GET /version; info "Coolify $RESP_BODY"
  local uuid
  for spec in "project:PROJECT_UUID:/projects:$COOLIFY_PROJECT_NAME" "database:DB_UUID:/databases:$COOLIFY_DB_NAME" \
    "backend:BACKEND_APP_UUID:/applications:$COOLIFY_API_APP_NAME" "frontend:FRONTEND_APP_UUID:/applications:$COOLIFY_WEB_APP_NAME"; do
    IFS=: read -r label key path name <<<"$spec"
    uuid="$(resolve "$key" "$path" "$name")"
    if [ -z "$uuid" ]; then info "$label: not created"; continue; fi
    api GET "$path/$uuid"
    local extra=""
    [ "$path" != /applications ] || extra=" · source: $(json_field git_repository)@$(json_field git_branch)"
    info "$label '$name' ($uuid): $(json_field status)$extra"
  done
  for url in "https://$API_DOMAIN/api/v1/health" "https://$APP_DOMAIN/login"; do
    info "$url -> HTTP $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
  done
}

main() {
  local cmd="${1:-help}"; shift || true
  TARGET=all; ASSUME_YES=false
  for arg in "$@"; do
    case "$arg" in
      backend|frontend|all) TARGET="$arg" ;;
      --yes|-y) ASSUME_YES=true ;;
      *) die "unknown argument '$arg'" ;;
    esac
  done
  case "$cmd" in
    init|update|reset|teardown|status) load_env; "cmd_$cmd" ;;
    help|-h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//' ;;
    *) die "unknown command '$cmd' (init, update, reset, teardown, status)" ;;
  esac
}
main "$@"
