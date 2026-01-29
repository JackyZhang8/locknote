#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./build.sh [platform] [arch] [--clean] [--debug]
# Examples:
#   ./build.sh darwin arm64
#   ./build.sh windows amd64 --clean
#   ./build.sh all

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PLATFORM="${1:-darwin}"
ARCH="${2:-}" 
CLEAN=false
DEBUG=false

for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
    --debug) DEBUG=true ;;
    -h|--help)
      cat <<EOF
Usage: ./build.sh [platform] [arch] [--clean] [--debug]

platform:
  darwin | windows | linux | all

arch (optional):
  amd64 | arm64

flags:
  --clean   pass -clean to wails build
  --debug   pass -debug to wails build

Notes:
- Icon: this script syncs icons/favicon-512x512.png -> build/appicon.png
  because Wails uses build/appicon.png to generate platform-specific icons.
EOF
      exit 0
      ;;
  esac
done

sync_icon() {
  local src_2048="$ROOT_DIR/icons/favicon-2048x2048.png"
  local src_512="$ROOT_DIR/icons/favicon-512x512.png"
  local src=""
  local dst="$ROOT_DIR/build/appicon.png"

  if [[ -f "$src_2048" ]]; then
    src="$src_2048"
  elif [[ -f "$src_512" ]]; then
    src="$src_512"
  else
    echo "ERROR: Icon source not found." >&2
    echo "Expected one of:" >&2
    echo "  - $src_2048" >&2
    echo "  - $src_512" >&2
    echo "Tip: macOS app icons look best with >=1024x1024 PNG. Your icons/ already contains 2048x2048, prefer that." >&2
    exit 1
  fi

  mkdir -p "$ROOT_DIR/build"
  cp "$src" "$dst"
}

build_one() {
  local p="$1"
  local a="$2"

  local args=("build")

  if $CLEAN; then
    args+=("-clean")
  fi
  if $DEBUG; then
    args+=("-debug")
  fi

  if [[ -n "$p" ]]; then
    if [[ -n "$a" ]]; then
      args+=("-platform" "${p}/${a}")
    else
      args+=("-platform" "${p}")
    fi
  fi

  echo "==> wails ${args[*]}"
  wails "${args[@]}"
}

sync_icon

case "$PLATFORM" in
  darwin|windows|linux)
    build_one "$PLATFORM" "$ARCH"
    ;;
  all)
    # Build host default arch for each platform unless arch is provided
    if [[ -n "$ARCH" ]]; then
      build_one "darwin" "$ARCH"
      build_one "windows" "$ARCH"
      build_one "linux" "$ARCH"
    else
      build_one "darwin" ""
      build_one "windows" ""
      build_one "linux" ""
    fi
    ;;
  *)
    echo "ERROR: Unknown platform: $PLATFORM" >&2
    echo "Use: darwin | windows | linux | all" >&2
    exit 1
    ;;
esac
