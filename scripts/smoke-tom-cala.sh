#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
USER_ID="${USER_ID:-user_demo_aftermeet}"

echo "Running AfterMeet Tom/Cala smoke flow against ${BASE_URL}"

echo "Step 1/3: ensure objective"
OBJECTIVE_RESP=$(curl -fsS -X POST "${BASE_URL}/api/objectives" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"role\":\"founder\",\"primaryGoal\":\"find_users\",\"activeGoals\":[\"find_users\",\"find_design_partners\"],\"eventContext\":\"MEGATHON\",\"companyName\":\"AfterMeet\",\"productDescription\":\"A goal-conditioned relationship intelligence layer for networking events.\",\"targetCustomer\":\"Event-heavy founders and operators\",\"attentionBudgetToday\":5,\"preferredTone\":\"warm\"}")
OBJECTIVE_ID=$(printf '%s' "$OBJECTIVE_RESP" | node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(0,"utf8"));if(!o.objective?.id){console.error("Objective creation failed:",JSON.stringify(o));process.exit(1)};console.log(o.objective.id)')
echo "Objective ready: ${OBJECTIVE_ID}"

echo "Step 2/3: capture conversation"
CAPTURE_RESP=$(curl -fsS -X POST "${BASE_URL}/api/capture/text" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"rawText\":\"I met Tom Nicholson from Cala. We discussed how AfterMeet could support high-density networking workflows. Tom said this could be useful for their team and is open to a follow-up.\",\"eventContext\":\"MEGATHON\"}")
read -r REQUEST_ID CONVERSATION_ID < <(printf '%s' "$CAPTURE_RESP" | node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(0,"utf8"));if(!o.requestId||!o.conversationId){console.error("Capture failed:",JSON.stringify(o));process.exit(1)};console.log(`${o.requestId} ${o.conversationId}`)')
echo "Captured: requestId=${REQUEST_ID} conversationId=${CONVERSATION_ID}"

echo "Step 3/3: enrich with Cala"
ENRICH_RESP=$(curl -fsS -X POST "${BASE_URL}/api/enrich/cala" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"conversationId\":\"${CONVERSATION_ID}\",\"name\":\"Tom Nicholson\",\"company\":\"Cala\",\"role\":\"Operator\",\"query\":\"Tom Nicholson Cala professional context\"}")
printf '%s' "$ENRICH_RESP" | node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(0,"utf8"));if(o.error){console.error("Enrichment failed:",JSON.stringify(o));process.exit(1)};console.log(JSON.stringify({available:o.available,entityMatchConfidence:o.entityMatchConfidence,candidateCount:Array.isArray(o.candidates)?o.candidates.length:0,warnings:o.warnings||[]},null,2));'

echo "Smoke flow complete."
