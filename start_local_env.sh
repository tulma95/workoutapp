#!/usr/bin/env bash
set -e

# Script to start the full local dev environment in tmux
# Creates a tmux session with 3 panes: Docker, Backend, Frontend
# Zero-config: works immediately after cloning with only Docker and tmux as prerequisites

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SESSION_NAME="treenisofta"

# Export environment variables (inherited by all tmux panes)
export DATABASE_URL="postgresql://treenisofta:treenisofta_dev@localhost:5432/treenisofta"
export JWT_SECRET="change-me-in-production"
export PORT=3001
export NODE_ENV=development

function stop() {
  docker compose down --remove-orphans || true
}
trap stop EXIT

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed"
    echo "Install tmux with: brew install tmux (macOS) or apt-get install tmux (Linux)"
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists. Attaching to it..."
    tmux attach-session -t "$SESSION_NAME"
    exit 0
fi

# Ensure dependencies are up-to-date before creating tmux session
source scripts/common.sh
ensure_dependencies

# Start database and wait for it to be healthy
echo "Starting database..."
docker compose up -d --wait

# Create new session with first pane showing docker logs
echo "Creating tmux session '$SESSION_NAME'..."
tmux new-session -d -s "$SESSION_NAME" -n "dev" "docker compose logs -f"

# Split window vertically for backend pane
tmux split-window -t "$SESSION_NAME:dev" -v

# Split window vertically again for frontend pane
tmux split-window -t "$SESSION_NAME:dev" -v

# Select even-vertical layout for equal pane sizes
tmux select-layout -t "$SESSION_NAME:dev" even-vertical

# Send commands to pane 1 (backend) - uses run_backend.sh for full setup
tmux send-keys -t "$SESSION_NAME:dev.1" './run_backend.sh' C-m

# Send commands to pane 2 (frontend)
tmux send-keys -t "$SESSION_NAME:dev.2" 'npm run dev -w frontend' C-m

# Attach to the session
echo "Environment started! Attaching to session..."
tmux attach-session -t "$SESSION_NAME"
