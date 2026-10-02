#!/usr/bin/env bash
# 개인 작업 이력을 제외하고 하네스 파일만 설치합니다.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=0
PRINT_SETTINGS=0
case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN=1 ;;
  --print-settings) PRINT_SETTINGS=1 ;;
  --help) echo "사용법: bash $0 [--dry-run | --print-settings]"; exit 0 ;;
  *) echo "지원하지 않는 옵션: $1 (복사 설치만 지원)" >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { echo "옵션은 하나만 지정하세요." >&2; exit 2; }
fail() { echo "$*" >&2; exit 1; }
[[ -n "${HOME:-}" && "$HOME" == /* && -d "$HOME" ]] || fail "실제 홈 디렉터리가 필요합니다."
BACKUP_ROOT=""
CHANGED=0

# 쓰기 전에 전체 대상의 링크와 유형을 검사해 외부 원본 수정을 방지합니다.
check_tree() {
  local src="$1" dst="$2" child
  [[ ! -L "$src" ]] || fail "원본 심볼릭 링크는 지원하지 않습니다: $src"
  [[ ! -L "$dst" ]] || fail "기존 심볼릭 링크를 먼저 별도 이관하세요: $dst"
  if [[ -d "$src" ]]; then
    [[ ! -e "$dst" || -d "$dst" ]] || fail "디렉터리 대상에 파일이 있습니다: $dst"
    for child in "$src"/* "$src"/.[!.]* "$src"/..?*; do
      [[ -e "$child" || -L "$child" ]] || continue
      check_tree "$child" "$dst/${child##*/}"
    done
  else
    [[ -f "$src" ]] || fail "필수 원본 파일이 없습니다: $src"
    [[ ! -e "$dst" || -f "$dst" ]] || fail "파일 대상에 다른 유형이 있습니다: $dst"
  fi
}

# 홈 기준 상대 경로를 유지해 백업 원본을 구분합니다.
install_tree() {
  local src="$1" dst="$2" child relative
  if [[ -d "$src" ]]; then
    for child in "$src"/* "$src"/.[!.]* "$src"/..?*; do
      [[ -e "$child" || -L "$child" ]] || continue
      install_tree "$child" "$dst/${child##*/}"
    done
    return
  fi
  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then return; fi
  echo "갱신: $dst"
  CHANGED=$((CHANGED + 1))
  [[ "$DRY_RUN" -eq 0 ]] || return 0
  if [[ -f "$dst" ]]; then
    if [[ -z "$BACKUP_ROOT" ]]; then
      BACKUP_ROOT="$(mktemp -d "$HOME/$BACKUP_PREFIX.XXXXXXXX")"
      echo "백업: $BACKUP_ROOT"
    fi
    relative="${dst#"$HOME"/}"
    mkdir -p "$BACKUP_ROOT/$(dirname "$relative")"
    cp -p "$dst" "$BACKUP_ROOT/$relative"
  fi
  mkdir -p "$(dirname "$dst")"
  cp -p "$src" "$dst"
}

check_root() {
  [[ ! -L "$1" ]] || fail "설치 루트가 심볼릭 링크입니다: $1"
  [[ ! -e "$1" || -d "$1" ]] || fail "설치 루트가 디렉터리가 아닙니다: $1"
}

CLAUDE_DIR="$HOME/.claude"
BACKUP_PREFIX="claude-dotfiles-backup"
[[ -z "${CLAUDE_CONFIG_DIR:-}" || "$CLAUDE_CONFIG_DIR" == "$CLAUDE_DIR" ]] ||
  fail "사용자 지정 CLAUDE_CONFIG_DIR은 지원하지 않습니다. 기본 홈 설치인지 확인하세요."
check_root "$CLAUDE_DIR"
for item in CLAUDE.md rules hooks deny-patterns.json; do
  check_tree "$REPO/$item" "$CLAUDE_DIR/$item"
done
check_tree "$REPO/settings.macos.json" "$CLAUDE_DIR/settings.json"
command -v node >/dev/null 2>&1 || fail "훅 실행 및 설정 생성을 위해 Node.js가 필요합니다."
# JSON 직렬화로 홈 경로의 특수문자를 안전하게 처리합니다.
SETTINGS_CONTENT="$(node -e '
const fs = require("fs");
const source = JSON.parse(fs.readFileSync(process.argv[1], "utf8").replace(/^\uFEFF/, ""));
function expand(value) {
  if (typeof value === "string") return value.split("__HOME__").join(process.env.HOME);
  if (Array.isArray(value)) return value.map(expand);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item)]));
  }
  return value;
}
process.stdout.write(JSON.stringify(expand(source), null, 2) + "\n");
' "$REPO/settings.macos.json")"
# 설정안만 출력하는 모드에서는 파일 및 백업을 생성하지 않습니다.
if [[ "$PRINT_SETTINGS" -eq 1 ]]; then
  printf '%s\n' "$SETTINGS_CONTENT"
  exit 0
fi
for item in CLAUDE.md rules hooks deny-patterns.json; do
  install_tree "$REPO/$item" "$CLAUDE_DIR/$item"
done
if [[ -e "$CLAUDE_DIR/settings.json" ]]; then
  echo "보존: $CLAUDE_DIR/settings.json (훅이 자동 등록되지는 않습니다)"
  printf '설정 비교: diff -u %q <(bash %q --print-settings)\n' "$CLAUDE_DIR/settings.json" "$REPO/install-macos.sh"
else
  echo "생성: $CLAUDE_DIR/settings.json"
  CHANGED=$((CHANGED + 1))
  if [[ "$DRY_RUN" -eq 0 ]]; then
    mkdir -p "$CLAUDE_DIR"
    printf '%s\n' "$SETTINGS_CONTENT" > "$CLAUDE_DIR/settings.json"
  fi
fi
echo "완료: 변경 대상 $CHANGED 파일, dry-run=$DRY_RUN"
echo "plans와 work-history는 설치하지 않습니다."
echo "MCP는 자동 등록하지 않습니다. 필요한 서버만 claude mcp add로 등록하세요."
