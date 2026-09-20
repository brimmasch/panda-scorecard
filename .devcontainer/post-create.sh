#!/usr/bin/env bash
# Runs once per container create (see devcontainer.json postCreateCommand).
set -euo pipefail

# Named volumes mount empty and root-owned when the image has nothing at the
# target path, so every persisted dir needs handing back to node.
sudo chown -R node:node \
	/workspaces/panda-scorecard/node_modules \
	/home/node/.claude \
	/home/node/.config \
	/home/node/.copilot

chmod 700 /home/node/.claude

# Restore home-dir state from a pre-rebuild snapshot, if one is sitting there.
if [ -f /workspaces/panda-scorecard/.devcontainer/backup/home-state.tar.gz ]; then
	bash /workspaces/panda-scorecard/.devcontainer/restore-home.sh
fi

npm install
