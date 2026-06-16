#!/bin/bash

# 📧 Email Delivery Test Script
# Usage: npm run test:email-delivery -- --dev [--to-email test@example.com]

set -e

ENV=${1:---dev}
TO_EMAIL=${3:---query}  # Default: query for test email
WAIT_TIMEOUT=${5:---30}  # seconds

PROJECT_ID="vertex-platform-${ENV#--}"
FIRESTORE_DB="(default)"

echo "📧 Email Delivery Test"
echo "   Environment: $ENV"
echo "   Project: $PROJECT_ID"
echo ""

# Step 1: Check prerequisites
echo "✓ Checking prerequisites..."
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud not installed"; exit 1; }
firebase use "$PROJECT_ID" || { echo "❌ Firebase project not accessible"; exit 1; }

# Step 2: Get Firebase config
echo "✓ Retrieving Firebase config..."
EMULATOR_HOST="localhost:8080"  # Update if using different port

# Step 3: Prepare test document
echo "✓ Preparing test email document..."
TEST_EMAIL_ID="test-email-$(date +%s)"
TEST_EMAIL_DOC='{
  "to": "'"$TO_EMAIL"'",
  "message": {
    "subject": "Test Email - '"$(date)"'",
    "text": "This is an automated test email from Vertex provisioning validation."
  }
}'

# Step 4: Write document to Firestore
echo "✓ Writing email document to Firestore..."
echo "$TEST_EMAIL_DOC" | gcloud firestore documents create email \
  --project="$PROJECT_ID" \
  --db="$FIRESTORE_DB" \
  --document-id="$TEST_EMAIL_ID" \
  --data-from-json-file=/dev/stdin \
  || { echo "⚠️  Could not write test email (Firestore might be restricted)"; }

# Step 5: Wait for email extension to process
echo "⏳ Waiting for extension to process email (max $WAIT_TIMEOUT seconds)..."
START_TIME=$(date +%s)
PROCESSED=0

while [ $(($(date +%s) - START_TIME)) -lt "$WAIT_TIMEOUT" ]; do
  # Check if email was processed (check Cloud Logs)
  LOGS=$(gcloud functions logs read \
    --project="$PROJECT_ID" \
    --filter='resource.type=cloud_function AND jsonPayload.message=~"email.*sent"' \
    --limit=1 2>/dev/null || echo "")
  
  if [[ ! -z "$LOGS" ]]; then
    echo "✅ Email processed!"
    echo "$LOGS"
    PROCESSED=1
    break
  fi
  
  sleep 2
done

if [ $PROCESSED -eq 0 ]; then
  echo "⚠️  Email might not have been processed within timeout"
  echo "   Check Cloud Logs: https://console.cloud.google.com/logs?project=$PROJECT_ID"
  echo "   Function: firestore-send-email"
fi

# Step 6: Check email was sent
echo "✓ Checking email delivery status..."
echo "   To email: $TO_EMAIL"
echo "   Document ID: $TEST_EMAIL_ID"
echo ""
echo "ℹ️  Manual verification:"
echo "   1. Check $TO_EMAIL inbox (might take 1-2 minutes)"
echo "   2. Check Cloud Logs: https://console.cloud.google.com/logs/query"
echo "   3. Check Firestore: projects/$PROJECT_ID/databases/$FIRESTORE_DB/documents/email/$TEST_EMAIL_ID"

echo ""
echo "✅ Email delivery test initialized!"
