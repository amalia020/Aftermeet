#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
USER_ID="${USER_ID:-user_demo_aftermeet}"

echo "Running one-call workflow smoke test against ${BASE_URL}"

RESP=$(curl -fsS -X POST "${BASE_URL}/api/workflows/capture-enrich" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"rawText\":\"I met Tom Nicholson from Cala. We discussed how AfterMeet could support high-density networking workflows. Tom said this could be useful for their team and is open to a follow-up.\",\"eventContext\":\"MEGATHON\",\"name\":\"Tom Nicholson\",\"company\":\"Cala\",\"role\":\"Operator\",\"query\":\"Tom Nicholson Cala professional context\",\"allowUncitedClaims\":true,\"ensureObjective\":true}")

printf '%s' "$RESP" | node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(0,"utf8"));if(o.error){console.error("Workflow failed:",JSON.stringify(o));process.exit(1)};console.log(JSON.stringify({objective:o.objective,capture:o.capture,cala:{available:o.cala?.available,entityMatchConfidence:o.cala?.entityMatchConfidence,candidateCount:Array.isArray(o.cala?.candidates)?o.cala.candidates.length:0},webFallback:o.webFallback?{available:o.webFallback.available,claimCount:Array.isArray(o.webFallback.claims)?o.webFallback.claims.length:0,warnings:o.webFallback.warnings||[]}:null},null,2));'

echo "Workflow smoke flow complete."
