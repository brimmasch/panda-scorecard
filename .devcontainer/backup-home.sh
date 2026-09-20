#!/usr/bin/env bash
# Snapshot container-only home state onto the host bind mount so it survives a
# rebuild. Runs automatically on attach (see devcontainer.json postAttachCommand)
# and can be run by hand right before "Rebuild Container".
#
# The archive holds live credentials (Claude login, gh tokens). It is gitignored,
# but delete it once you no longer need the fallback copy.
set -euo pipefail

DEST="${1:-/workspaces/panda-scorecard/.devcontainer/backup}"
ARCHIVE="$DEST/home-state.tar.gz"
mkdir -p "$DEST"

cd "$HOME"

paths=()
for p in .claude .claude.json .config/gh .copilot .gitconfig .zsh_history .bash_history; do
	[ -e "$p" ] && paths+=("$p")
done

if [ ${#paths[@]} -eq 0 ]; then
	echo "Nothing to back up." >&2
	exit 1
fi

# Build alongside the target so the final move is atomic.
tmp="$(mktemp "$DEST/.home-state.XXXXXX.tar.gz")"
trap 'rm -f "$tmp"' EXIT
tar -czf "$tmp" "${paths[@]}"

# A restore that silently failed would otherwise let an empty snapshot clobber a
# good one, so never trade transcripts for none.
transcripts=$(tar -tzf "$tmp" | grep -c '\.jsonl$' || true)
if [ "$transcripts" -eq 0 ] && [ -f "$ARCHIVE" ]; then
	echo "New snapshot has no transcripts; keeping existing $ARCHIVE" >&2
	exit 1
fi

[ -f "$ARCHIVE" ] && cp -p "$ARCHIVE" "$ARCHIVE.prev"
mv "$tmp" "$ARCHIVE"
trap - EXIT
chmod 600 "$ARCHIVE"

echo "Wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1), $transcripts transcript(s))"
