#!/usr/bin/env bash
# Install Arbora Canvas binary
# Usage: curl -fsSL https://raw.githubusercontent.com/your-org/arbora-plugin/main/scripts/install-canvas.sh | bash

set -euo pipefail

INSTALL_DIR="${ARBORA_CANVAS_INSTALL_DIR:-$HOME/.local/bin}"
GITHUB_REPO="${ARBORA_CANVAS_REPO:-your-org/arbora-plugin}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[arbora-canvas]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[arbora-canvas]${NC} $1"
}

error() {
  echo -e "${RED}[arbora-canvas]${NC} $1" >&2
  exit 1
}

# Detect OS and architecture
detect_platform() {
  local os arch

  case "$(uname -s)" in
    Linux)  os="linux" ;;
    Darwin) os="macos" ;;
    *)      error "Unsupported OS: $(uname -s)" ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)    arch="x64" ;;
    aarch64|arm64)   arch="arm64" ;;
    *)               error "Unsupported architecture: $(uname -m)" ;;
  esac

  echo "${os}-${arch}"
}

# Get latest release version
get_latest_version() {
  local url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
  curl -sL "$url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo ""
}

# Get specific canvas release version
get_canvas_version() {
  local url="https://api.github.com/repos/${GITHUB_REPO}/releases"
  curl -sL "$url" | grep '"tag_name":' | grep 'canvas-v' | head -1 | sed -E 's/.*"canvas-v([^"]+)".*/\1/' || echo ""
}

main() {
  log "Installing Arbora Canvas..."

  # Detect platform
  local platform=$(detect_platform)
  log "Detected platform: $platform"

  # Get version
  local version=$(get_canvas_version)
  if [[ -z "$version" ]]; then
    error "Could not determine latest version. Check your internet connection."
  fi
  log "Latest version: $version"

  # Build download URL
  local asset_name="arbora-canvas-${platform}.tar.gz"
  local download_url="https://github.com/${GITHUB_REPO}/releases/download/canvas-v${version}/${asset_name}"

  # Create install directory
  mkdir -p "$INSTALL_DIR"

  # Download and extract
  log "Downloading from $download_url..."
  local tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  if ! curl -fsSL "$download_url" -o "$tmp_dir/$asset_name"; then
    error "Failed to download. Check if release exists for your platform."
  fi

  log "Extracting..."
  tar -xzf "$tmp_dir/$asset_name" -C "$tmp_dir"

  # Install binary
  local binary="$tmp_dir/arbora-canvas"
  if [[ ! -f "$binary" ]]; then
    error "Binary not found in archive"
  fi

  chmod +x "$binary"
  mv "$binary" "$INSTALL_DIR/arbora-canvas"

  log "Installed to $INSTALL_DIR/arbora-canvas"

  # Check if install dir is in PATH
  if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    warn "Note: $INSTALL_DIR is not in your PATH"
    warn "Add this to your shell profile:"
    warn "  export PATH=\"\$PATH:$INSTALL_DIR\""
  fi

  # Verify installation
  if command -v arbora-canvas &>/dev/null; then
    log "Installation complete! Run 'arbora-canvas' to start."
  else
    log "Installation complete!"
    log "Run '$INSTALL_DIR/arbora-canvas' to start, or add the directory to your PATH."
  fi
}

main "$@"
