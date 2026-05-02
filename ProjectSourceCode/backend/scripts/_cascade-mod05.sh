#!/bin/bash
# Cascade SKILL-02-S → SKILL-04 → SKILL-05 for MOD-05 with auto-approval.
# Approves the existing AWAITING_REVIEW SKILL-01-S execution first.

set -uo pipefail

MOD=2bb3845e-7254-4608-b6ae-5eca0d4c11b1
SKILL_01_EXEC=a628b98e-7c66-4edb-9eed-6421dc3b6e39
BASE=http://localhost:4000/api/ba

ts() { date +"%H:%M:%S"; }

approve_exec() {
  local execId=$1
  local label=$2
  curl -sS -X POST "$BASE/executions/$execId/approve" >/dev/null
  echo "[$(ts)] APPROVED $label  exec=$execId"
}

fetch_field() {
  local execId=$1
  local field=$2
  curl -sS "$BASE/modules/$MOD/execution/$execId" | python -c "import sys,json; d=json.load(sys.stdin); v=d.get('$field') or ''; print(v if isinstance(v,str) else str(v))"
}

run_skill() {
  local skill=$1
  echo ""
  echo "[$(ts)] ── Firing $skill ──"
  local response
  response=$(curl -sS -X POST "$BASE/modules/$MOD/execute/$skill")
  local execId
  execId=$(echo "$response" | python -c "import sys,json; print(json.load(sys.stdin).get('executionId',''))")
  if [ -z "$execId" ]; then
    echo "[$(ts)] FAILED to start $skill: $response"
    return 1
  fi
  echo "[$(ts)] $skill exec=$execId"

  local last="UNKNOWN"
  while true; do
    sleep 15
    local status
    status=$(fetch_field "$execId" "status")
    if [ "$status" != "$last" ]; then
      echo "[$(ts)]   $skill status: $status"
      last="$status"
    fi
    if [ "$status" = "AWAITING_REVIEW" ]; then
      approve_exec "$execId" "$skill"
      return 0
    fi
    if [ "$status" = "FAILED" ]; then
      local errMsg
      errMsg=$(fetch_field "$execId" "errorMessage")
      echo "[$(ts)] $skill FAILED:"
      echo "$errMsg" | head -20 | sed 's/^/    /'
      return 1
    fi
  done
}

echo "[$(ts)] ══ MOD-05 cascade start ══"

# Step 0: approve the existing SKILL-01-S
echo "[$(ts)] ── Approving SKILL-01-S ──"
approve_exec "$SKILL_01_EXEC" "SKILL-01-S"

# Step 1: SKILL-02-S (prior MOD-05 run took ~55s)
run_skill "SKILL-02-S" || { echo "[$(ts)] cascade aborted at SKILL-02-S"; exit 1; }

# Step 2: SKILL-04 (prior MOD-05 run took ~16 min — per-feature loop)
run_skill "SKILL-04" || { echo "[$(ts)] cascade aborted at SKILL-04"; exit 1; }

# Step 3: SKILL-05 (prior MOD-05 run took ~30s)
run_skill "SKILL-05" || { echo "[$(ts)] cascade aborted at SKILL-05"; exit 1; }

echo ""
echo "[$(ts)] ══ MOD-05 cascade COMPLETE ══"
echo "[$(ts)] All four skills approved. Module should now be at APPROVED status."
