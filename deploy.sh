#!/usr/bin/env bash
# Deploy fe-meeting-management trên server: pull, cài dependencies, lint + test, build vào một thư mục release mới,
# rồi trỏ symlink `current` sang bản đó (nginx phục vụ `current`, không có lúc nào thư mục web bị rỗng).
#
#   npm run deploy               deploy bản mới
#   npm run deploy -- --rollback quay về release liền trước
#
# Biến môi trường (tùy chọn):
#   VITE_MEETING_API_URL  URL backend meeting, ví dụ https://live.ichiskill.com (hoặc đặt trong .env / .env.production)
#   RELEASES_DIR          nơi chứa các bản build (mặc định ./releases)
#   CURRENT_LINK          symlink nginx dùng làm root (mặc định ./current)
#   KEEP_RELEASES         số release giữ lại (mặc định 5)
#   PUBLIC_URL            URL public của FE; nếu có thì kiểm tra trang đang phục vụ đúng bản vừa deploy
#   SKIP_TESTS=1          bỏ qua lint + test
#   SKIP_API_CHECK=1      không kiểm tra /health của backend trước khi build
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)

RELEASES_DIR=${RELEASES_DIR:-$ROOT/releases}
CURRENT_LINK=${CURRENT_LINK:-$ROOT/current}
KEEP_RELEASES=${KEEP_RELEASES:-5}

fail() {
  echo "❌ $*" >&2
  exit 1
}

# Đổi symlink current gần như nguyên tử: tạo link tạm rồi rename đè lên.
switch_current() {
  local target=$1 tmp="$CURRENT_LINK.tmp.$$"
  if [ -e "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ]; then
    fail "$CURRENT_LINK đã tồn tại và không phải symlink. Xóa hoặc đổi tên nó trước khi deploy."
  fi
  ln -sfn "$target" "$tmp"
  mv -T "$tmp" "$CURRENT_LINK" 2>/dev/null || { rm -f "$CURRENT_LINK"; mv "$tmp" "$CURRENT_LINK"; }
}

if [ "${1:-}" = "--rollback" ]; then
  [ -L "$CURRENT_LINK" ] || fail "Chưa có $CURRENT_LINK, không có gì để rollback."
  active=$(basename "$(readlink "$CURRENT_LINK")")
  previous=$(ls -1 "$RELEASES_DIR" | sort | awk -v a="$active" '$0 < a' | tail -n 1)
  [ -n "$previous" ] || fail "Không có release nào cũ hơn $active."
  switch_current "$RELEASES_DIR/$previous"
  echo "✅ Đã rollback: $active → $previous"
  exit 0
fi

# git pull có thể sửa chính file này khi bash đang đọc dở; pull xong thì chạy lại bản mới từ đầu.
if [ -z "${DEPLOY_PULLED:-}" ]; then
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    echo "👉 Pull code..."
    git pull --ff-only
  else
    echo "⚠️  Nhánh hiện tại chưa có upstream, bỏ qua git pull."
  fi
  DEPLOY_PULLED=1 exec bash "./$(basename "$0")" "$@"
fi

echo "👉 Cài dependencies (npm ci)..."
npm ci --no-audit --no-fund

# Lấy URL backend đúng như Vite sẽ dùng khi build (env thật, rồi .env.production.local, .env.production, .env...).
API_URL=$(node --input-type=module -e "
  import { loadEnv } from 'vite';
  console.log(loadEnv('production', process.cwd(), 'VITE_').VITE_MEETING_API_URL || '');
")
if [ -n "$API_URL" ]; then
  API_URL=${API_URL%/}
  echo "   Backend: $API_URL"
  if [ -z "${SKIP_API_CHECK:-}" ]; then
    echo "👉 Kiểm tra $API_URL/health..."
    body=$(curl -fsS -m 10 "$API_URL/health" 2>/dev/null || true)
    [[ "$body" == *'"status":"ok"'* ]] || fail "Backend chưa sẵn sàng ($API_URL/health: ${body:-<không phản hồi>}). Đặt SKIP_API_CHECK=1 để bỏ qua."
  fi
else
  echo "⚠️  Chưa đặt VITE_MEETING_API_URL: FE sẽ gọi /meeting-api cùng origin, nginx phải proxy /meeting-api sang backend."
fi

if [ -z "${SKIP_TESTS:-}" ]; then
  echo "👉 Lint + test..."
  npm run lint
  npm test
  npm run test:ui
fi

RELEASE=$(date +%Y%m%d%H%M%S)
OUT="$RELEASES_DIR/$RELEASE"
mkdir -p "$RELEASES_DIR"
echo "👉 Build vào $OUT..."
npm run build -- --outDir "$OUT" --emptyOutDir

[ -s "$OUT/index.html" ] || fail "Build không tạo ra index.html."
if [ -n "$API_URL" ] && ! grep -rqF "$API_URL" "$OUT/assets"; then
  fail "Bản build không chứa URL backend $API_URL."
fi

echo "👉 Chuyển $CURRENT_LINK → $RELEASE..."
switch_current "$OUT"

# Dọn release cũ, không bao giờ xóa bản đang chạy.
ls -1 "$RELEASES_DIR" | sort -r | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [ "$old" = "$RELEASE" ] || rm -rf "${RELEASES_DIR:?}/$old"
done

if [ -n "${PUBLIC_URL:-}" ]; then
  # Tên file JS chính có hash nội dung, nên trang public chứa đúng tên này nghĩa là nginx đang phục vụ bản mới.
  entry=$(grep -o 'assets/index-[^"]*\.js' "$OUT/index.html" | head -n 1)
  echo "👉 Kiểm tra ${PUBLIC_URL}..."
  page=$(curl -fsS -m 10 -H 'Cache-Control: no-cache' "${PUBLIC_URL%/}/" 2>/dev/null || true)
  [[ -n "$entry" && "$page" == *"$entry"* ]] || fail "${PUBLIC_URL} chưa phục vụ bản mới ($entry). Kiểm tra root của nginx trỏ vào $CURRENT_LINK."
fi

echo "✅ Deploy thành công: $RELEASE"
