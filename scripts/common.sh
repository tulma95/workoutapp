#!/usr/bin/env bash

# Common shell helpers for treenisofta project

# Ensures npm dependencies are up-to-date based on package-lock.json checksum
# If package-lock.json changed or node_modules is missing, runs npm install
ensure_dependencies() {
  local package_lock="package-lock.json"
  local checksum_file="node_modules/.package-lock-checksum"

  # Calculate current checksum of package-lock.json
  if [[ ! -f "$package_lock" ]]; then
    echo "Error: $package_lock not found"
    exit 1
  fi

  # Detect OS and calculate checksum
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    current_checksum=$(md5 -q "$package_lock")
  else
    # Linux
    current_checksum=$(md5sum "$package_lock" | awk '{print $1}')
  fi

  # Check if we need to install
  need_install=false

  if [[ ! -d "node_modules" ]]; then
    echo "node_modules directory not found"
    need_install=true
  elif [[ ! -f "$checksum_file" ]]; then
    echo "Checksum file not found"
    need_install=true
  else
    stored_checksum=$(cat "$checksum_file")
    if [[ "$current_checksum" != "$stored_checksum" ]]; then
      echo "package-lock.json has changed"
      need_install=true
    fi
  fi

  if [[ "$need_install" == true ]]; then
    echo "Running npm install..."
    npm install
    if [[ $? -ne 0 ]]; then
      echo "Error: npm install failed"
      exit 1
    fi

    # Store the new checksum
    echo "$current_checksum" > "$checksum_file"
    echo "Dependencies updated successfully"
  else
    echo "Dependencies are up-to-date"
  fi
}
