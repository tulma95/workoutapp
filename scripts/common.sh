#!/usr/bin/env bash

# Common shell helpers for treenisofta project

# Shared test environment config
TEST_DB_URL="postgresql://treenisofta:treenisofta_dev@localhost:5433/treenisofta_test"
TEST_JWT_SECRET="test-jwt-secret-do-not-use-in-production"
TEST_VAPID_PUBLIC_KEY="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPUj21WptYZO85SRcSI1zDiwhatAMxOp786i8jcFbYHW4zrE5ufqRTls3RXWWynpKf8Antn8yCB9HE8DSxeyVrw"
TEST_VAPID_PRIVATE_KEY="MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgLCOEV2Iyfm1d18dea_QPg3plCbyxIbGZMqqOfRbN246hRANCAAQ9SPbVam1hk7zlJFxIjXMOLCFq0AzE6nvzqLyNwVtgdbjOsTm5-pFOWzdFdZbKekp_wCe2fzIIH0cTwNLF7JWv"

# Wrapper that passes test env vars inline to docker compose
test_compose() {
  TEST_JWT_SECRET="$TEST_JWT_SECRET" \
  TEST_VAPID_PUBLIC_KEY="$TEST_VAPID_PUBLIC_KEY" \
  TEST_VAPID_PRIVATE_KEY="$TEST_VAPID_PRIVATE_KEY" \
  docker compose "$@"
}

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
