#!/usr/bin/env bash
set -Eeuo pipefail

LOCAL_DIR="/home/lilyco/文档/deepseek-harness/default-workspace/lyco_music/web/downloads-page/dist"
SSH_CFG="/home/lilyco/.ssh/config"
HOST="lain42.top"
REMOTE_DIR="/var/www/studio/downloads"
PUBLIC="https://lain42.top"
MARKET="https://market.lain42.top"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="/tmp/lyco-root-downloads-$STAMP"
JS_NAME="app._A0d1J8x.js"
CSS_NAME="index.CBOUzgn-.css"
INDEX_SHA="6baaf157390e3882bf586d4bd6bfe60bff890cc1d10e290863947dee755c0e54"
JS_SHA="8efcdc951a3295c8b9ebc4081c3c7b61dbe9eb392950a38de014345259426349"
CSS_SHA="35cea2ef0c023096d9154b69d5c3db2c1ee34648afcdf2c4f50da1fd62e6e1ac"
OLD_INDEX_SHA="18debf4ad512034d1562dee94e565505f545c2197862751a605137ab40d4c328"
BACKUP="$REMOTE_DIR/index.html.bak-rootdownloadhelp-$STAMP"
INDEX_TMP="$REMOTE_DIR/.index.html.rootdownloadhelp-$STAMP.tmp"
BASELINE="/tmp/lyco-root-downloads-prod-before-$STAMP.txt"
AFTER="/tmp/lyco-root-downloads-prod-after-$STAMP.txt"
HTML_BODY="/tmp/lyco-root-downloads-index-$STAMP.html"
JS_BODY="/tmp/lyco-root-downloads-js-$STAMP.js"
CSS_BODY="/tmp/lyco-root-downloads-css-$STAMP.css"
OLD_JS_BODY="/tmp/lyco-root-downloads-old-js-$STAMP.js"
OLD_CSS_BODY="/tmp/lyco-root-downloads-old-css-$STAMP.css"
MARKET_BODY="/tmp/lyco-root-downloads-market-$STAMP.html"
BACKUP_CREATED=0

log() { printf '[root-downloads] %s\n' "$1"; }
die() { printf '[root-downloads] ERROR: %s\n' "$1" >&2; exit 1; }
ssh_cmd() { /usr/bin/ssh -F "$SSH_CFG" "$HOST" "$1"; }
curl_check() { /usr/bin/curl -sS --max-time 20 -o "$2" -w '%{http_code} %{size_download}' "$1"; }
code_of() { printf '%s' "$1" | /usr/bin/cut -d' ' -f1; }

rollback() {
  if [ "$BACKUP_CREATED" = "1" ]; then
    log "rolling back index.html from backup"
    ssh_cmd "if [ -f '$BACKUP' ]; then mv -f '$BACKUP' '$REMOTE_DIR/index.html' && echo ROLLBACK_INDEX_OK; fi" || true
  fi
}
trap 'rc=$?; if [ "$rc" -ne 0 ]; then echo "[root-downloads] DEPLOY_FAILED_RC=$rc"; rollback; fi' EXIT

log "local artifact preflight"
test -f "$LOCAL_DIR/index.html" || die "missing local index.html"
test -f "$LOCAL_DIR/page/$JS_NAME" || die "missing local JS"
test -f "$LOCAL_DIR/page/$CSS_NAME" || die "missing local CSS"
echo "$INDEX_SHA  $LOCAL_DIR/index.html" | /usr/bin/sha256sum -c - >/dev/null
echo "$JS_SHA  $LOCAL_DIR/page/$JS_NAME" | /usr/bin/sha256sum -c - >/dev/null
echo "$CSS_SHA  $LOCAL_DIR/page/$CSS_NAME" | /usr/bin/sha256sum -c - >/dev/null
/usr/bin/grep -Fq '机器识别与远程工具帮助' "$LOCAL_DIR/page/$JS_NAME" || die "help card missing from JS"
/usr/bin/grep -Fq 'noreferrer noopener' "$LOCAL_DIR/page/$JS_NAME" || die "safe rel missing from JS"
if /usr/bin/grep -Fq 'geolocation' "$LOCAL_DIR/page/$JS_NAME"; then die "unexpected geolocation reference in JS"; fi

log "remote preflight"
ssh_cmd "id -un; test -d '$REMOTE_DIR'; test -w '$REMOTE_DIR'; test -w '$REMOTE_DIR/page'; sha256sum '$REMOTE_DIR/index.html' | /usr/bin/grep -Fq '$OLD_INDEX_SHA' || { echo OLD_INDEX_HASH_MISMATCH; exit 1; }; df -k /var/www/studio | /usr/bin/tail -1; systemctl is-active pingap.service" >/tmp/lyco-root-downloads-remote-preflight-$STAMP.txt
cat /tmp/lyco-root-downloads-remote-preflight-$STAMP.txt
ssh_cmd "stat -c '%n %s %y' /opt/studio-billing/billing.db /opt/studio-billing/app.py /etc/pingap.toml" > "$BASELINE"
cat "$BASELINE"

log "upload artifacts to $TMP"
ssh_cmd "mkdir -p '$TMP' && chmod 700 '$TMP'"
/usr/bin/scp -F "$SSH_CFG" -q "$LOCAL_DIR/index.html" "$LOCAL_DIR/page/$JS_NAME" "$LOCAL_DIR/page/$CSS_NAME" "$HOST:$TMP/"
ssh_cmd "cd '$TMP' && printf '%s  %s\n%s  %s\n%s  %s\n' '$INDEX_SHA' index.html '$JS_SHA' '$JS_NAME' '$CSS_SHA' '$CSS_NAME' | /usr/bin/sha256sum -c -"

log "backup remote index.html"
ssh_cmd "cp -a '$REMOTE_DIR/index.html' '$BACKUP' && test -s '$BACKUP' && echo BACKUP_OK '$BACKUP'"
BACKUP_CREATED=1

log "install new assets and atomically switch index.html"
ssh_cmd "set -e; install -m 644 '$TMP/$JS_NAME' '$REMOTE_DIR/page/$JS_NAME'; install -m 644 '$TMP/$CSS_NAME' '$REMOTE_DIR/page/$CSS_NAME'; install -m 644 '$TMP/index.html' '$INDEX_TMP'; mv -f '$INDEX_TMP' '$REMOTE_DIR/index.html'; sha256sum '$REMOTE_DIR/index.html' '$REMOTE_DIR/page/$JS_NAME' '$REMOTE_DIR/page/$CSS_NAME'"

log "wait for public index to reference new artifacts"
ok=0
for i in $(seq 1 30); do
  result="$(curl_check "$PUBLIC/downloads" "$HTML_BODY" || true)"
  code="$(code_of "$result")"
  if [ "$code" = "200" ] && /usr/bin/grep -Fq "$JS_NAME" "$HTML_BODY" && /usr/bin/grep -Fq "$CSS_NAME" "$HTML_BODY"; then ok=1; break; fi
  sleep 1
done
[ "$ok" = "1" ] || die "public index did not switch to new assets"
log "public index switched: $result"

log "verify new and rollback assets over HTTPS"
fetch_asset() {
  local url="$1"
  local expect="$2"
  local body="$3"
  local result
  result="$(curl_check "$url" "$body" || true)"
  local code
  code="$(code_of "$result")"
  [ "$code" = "200" ] || return 1
  if [ -n "$expect" ]; then echo "$expect  $body" | /usr/bin/sha256sum -c - >/dev/null; fi
  printf '%s\n' "$result"
}
fetch_asset "$PUBLIC/downloads/page/$JS_NAME" "$JS_SHA" "$JS_BODY" || die "new JS asset failed"
fetch_asset "$PUBLIC/downloads/page/$CSS_NAME" "$CSS_SHA" "$CSS_BODY" || die "new CSS asset failed"
fetch_asset "$PUBLIC/downloads/page/app.CSovqzu2.js" "" "$OLD_JS_BODY" || die "rollback JS asset unavailable"
fetch_asset "$PUBLIC/downloads/page/index.C-iW4s74.css" "" "$OLD_CSS_BODY" || die "rollback CSS asset unavailable"
/usr/bin/grep -Fq '机器识别与远程工具帮助' "$JS_BODY" || die "help card text missing in public JS"
/usr/bin/grep -Fq 'https://rustdesk.com/' "$JS_BODY" || die "official domains missing in public JS"

log "verify market subdomain unchanged"
market_result="$(curl_check "$MARKET/downloads" "$MARKET_BODY" || true)"
market_code="$(code_of "$market_result")"
[ "$market_code" = "200" ] || die "market.lain42.top/downloads is not 200"
/usr/bin/grep -Fq '机器识别与远程工具帮助' "$MARKET_BODY" || die "market subdomain help card disappeared"
log "market intact: $market_result"

log "verify protected production files were not modified by deployment"
ssh_cmd "stat -c '%n %s %y' /opt/studio-billing/billing.db /opt/studio-billing/app.py /etc/pingap.toml" > "$AFTER"
echo "--- production stat diff (billing.db may reflect unrelated production activity) ---"
/usr/bin/diff -u "$BASELINE" "$AFTER" || true
for f in /opt/studio-billing/app.py /etc/pingap.toml; do
  before_line="$(/usr/bin/grep -F "$f " "$BASELINE" || true)"
  after_line="$(/usr/bin/grep -F "$f " "$AFTER" || true)"
  [ -n "$before_line" ] && [ "$before_line" = "$after_line" ] || die "protected file changed: $f"
done

ssh_cmd "rm -rf '$TMP' && echo REMOTE_TMP_CLEANED"
log "DEPLOY_OK stamp=$STAMP backup=$BACKUP js=$JS_NAME css=$CSS_NAME"
