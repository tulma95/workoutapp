#!/usr/bin/env bash
# Thin wrapper to run the auto-dev JS orchestrator.
# Usage:
#   ./auto_dev.sh              # Use sonnet (default)
#   ./auto_dev.sh --model opus # Use opus for complex tickets
#   ./auto_dev.sh --reset      # Clear state and start fresh
cd "$(dirname "$0")"
exec node auto-dev/run.js "$@"
