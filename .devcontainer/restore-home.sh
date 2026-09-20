#!/usr/bin/env bash
# Unpack a backup-home.sh snapshot into the new container. Called automatically
# by post-create.sh; safe to run by hand too.
set -euo pipefail

SRC="${1:-/workspaces/panda-scorecard/.devcontainer/backup/home-state.tar.gz}"
[ -f "$SRC" ] || { echo "No backup at $SRC" >&2; exit 1; }

tar -xzf "$SRC" -C "$HOME"

# CLAUDE_CONFIG_DIR now puts .claude.json inside the config dir, but snapshots
# taken before that change have it at ~/.claude.json.
if [ -n "${CLAUDE_CONFIG_DIR:-}" ] && [ -f "$HOME/.claude.json" ]; then
	mv -n "$HOME/.claude.json" "$CLAUDE_CONFIG_DIR/.claude.json"
fi

# gh refuses to read hosts.yml with loose permissions.
chmod 700 "$HOME/.claude" 2>/dev/null || true
chmod 600 "$HOME/.claude/.credentials.json" 2>/dev/null || true
chmod 700 "$HOME/.config/gh" 2>/dev/null || true
chmod 600 "$HOME/.config/gh/hosts.yml" 2>/dev/null || true

echo "Restored from $SRC — check with: gh auth status"
