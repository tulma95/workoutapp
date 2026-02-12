#!/usr/bin/env bash
set -e

# Script to start the full local dev environment in tmux
# Creates a tmux session with 3 panes: Docker, Backend, Frontend

SESSION_NAME="treenisofta"

function stop() {
  $local_compose down --remove-orphans || true
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

# Send commands to pane 1 (backend) - DB is already healthy, run migrations and start
tmux send-keys -t "$SESSION_NAME:dev.1" 'echo "Running migrations..."' C-m
tmux send-keys -t "$SESSION_NAME:dev.1" 'npx prisma migrate dev --name init -w backend' C-m
tmux send-keys -t "$SESSION_NAME:dev.1" 'echo "Starting backend server..."' C-m
tmux send-keys -t "$SESSION_NAME:dev.1" 'npm run dev -w backend' C-m

# Send commands to pane 2 (frontend)
tmux send-keys -t "$SESSION_NAME:dev.2" 'npm run dev -w frontend' C-m

# Attach to the session
echo "Environment started! Attaching to session..."
tmux attach-session -t "$SESSION_NAME"
