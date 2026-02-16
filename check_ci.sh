#!/usr/bin/env bash
# Check the latest GitHub Actions run status for this repo.
# Fetches logs automatically if the run failed.
# Downloads artifacts if they exist.
# Requires: curl, git, node, op (1Password CLI)

set -euo pipefail

REPO=$(git remote get-url origin | sed -E 's#.*github\.com[:/](.+)\.git#\1#')
ARTIFACT_DIR=".ci-artifacts"

# Fetch GitHub token from 1Password if not already set
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  GITHUB_TOKEN=$(op read "op://Private/github token/password" 2>/dev/null) || {
    echo "Failed to fetch GitHub token from 1Password."
    echo "Make sure 'op' is installed and you're signed in."
    exit 1
  }
fi

AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json")

# Fetch latest run
response=$(curl -s "${AUTH[@]}" \
  "https://api.github.com/repos/${REPO}/actions/runs?per_page=1")

# Parse run info and print summary
run_info=$(echo "$response" | node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const data = JSON.parse(c.join(''));
  if (data.message) { console.error('API error: ' + data.message); process.exit(1); }
  const runs = data.workflow_runs;
  if (!runs.length) { console.log('NO_RUNS'); process.exit(0); }

  const run = runs[0];
  const conclusion = run.conclusion || '-';
  const sha = run.head_sha.slice(0, 7);
  const icon = conclusion === 'success' ? '✅'
    : conclusion === 'failure' ? '❌'
    : run.status === 'in_progress' ? '⏳'
    : conclusion === 'cancelled' ? '🚫' : '⬜';
  const mins = Math.floor((Date.now() - new Date(run.created_at)) / 60000);
  const ago = mins < 60 ? mins + 'm ago'
    : mins < 1440 ? Math.floor(mins / 60) + 'h ago'
    : Math.floor(mins / 1440) + 'd ago';

  console.log(icon + ' ' + run.name);
  console.log('  Branch: ' + run.head_branch + ' (' + sha + ')');
  console.log('  Status: ' + run.status + ' / ' + conclusion);
  console.log('  When:   ' + ago);
  console.log('  URL:    ' + run.html_url);

  // Output run id and conclusion for the shell to use
  console.log('RUN_ID=' + run.id);
  console.log('CONCLUSION=' + conclusion);
});
")

if [[ "$run_info" == "NO_RUNS" ]]; then
  echo "No workflow runs found."
  exit 0
fi

# Extract RUN_ID and CONCLUSION, print the rest
RUN_ID=$(echo "$run_info" | grep '^RUN_ID=' | cut -d= -f2)
CONCLUSION=$(echo "$run_info" | grep '^CONCLUSION=' | cut -d= -f2)
echo "$run_info" | grep -v '^RUN_ID=\|^CONCLUSION='

# If failed, fetch and display logs
if [[ "$CONCLUSION" == "failure" ]]; then
  echo ""
  echo "--- Failed job logs ---"

  # Get failed jobs
  jobs_response=$(curl -s "${AUTH[@]}" \
    "https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/jobs")

  # Find failed job IDs
  failed_job_ids=$(echo "$jobs_response" | node -e "
    const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
      const jobs = JSON.parse(c.join('')).jobs || [];
      const failed = jobs.filter(j => j.conclusion === 'failure');
      failed.forEach(j => console.log(j.id + '|' + j.name));
    });
  ")

  if [[ -z "$failed_job_ids" ]]; then
    echo "No failed jobs found."
    exit 1
  fi

  while IFS='|' read -r job_id job_name; do
    echo ""
    echo "Job: $job_name"
    echo "---"
    # Fetch logs for this job
    logs=$(curl -sL "${AUTH[@]}" \
      "https://api.github.com/repos/${REPO}/actions/jobs/${job_id}/logs")
    # Show last 150 lines of logs (most relevant failure info)
    echo "$logs" | tail -150
  done <<< "$failed_job_ids"
fi

# Download artifacts if any exist
artifacts_response=$(curl -s "${AUTH[@]}" \
  "https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/artifacts")

artifact_list=$(echo "$artifacts_response" | node -e "
  const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
    const data = JSON.parse(c.join(''));
    const artifacts = data.artifacts || [];
    artifacts.forEach(a => console.log(a.id + '|' + a.name + '|' + a.size_in_bytes));
  });
")

if [[ -n "$artifact_list" ]]; then
  echo ""
  echo "--- Artifacts ---"
  rm -rf "$ARTIFACT_DIR"
  mkdir -p "$ARTIFACT_DIR"

  while IFS='|' read -r artifact_id artifact_name artifact_size; do
    size_kb=$(( artifact_size / 1024 ))
    echo "Downloading: $artifact_name (${size_kb}KB)"
    curl -sL "${AUTH[@]}" \
      "https://api.github.com/repos/${REPO}/actions/artifacts/${artifact_id}/zip" \
      -o "$ARTIFACT_DIR/${artifact_name}.zip"
    # Unzip into a subfolder
    unzip -qo "$ARTIFACT_DIR/${artifact_name}.zip" -d "$ARTIFACT_DIR/${artifact_name}"
    rm "$ARTIFACT_DIR/${artifact_name}.zip"
    echo "  Saved to: $ARTIFACT_DIR/${artifact_name}/"
  done <<< "$artifact_list"
fi
