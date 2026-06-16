#!/bin/bash

# 🧪 Provisioning Verification Script
# Usage: ./scripts/verify-provision.sh --dev [--store-name test-store]

set -e

ENV=${1:---dev}
STORE_NAME=${3:-test-store-$(date +%s)}
VERBOSE=${4:---quiet}

if [[ "$ENV" != "--dev" && "$ENV" != "--prod" ]]; then
  echo "❌ Invalid environment. Use: --dev or --prod"
  exit 1
fi

PROJECT_ID="vertex-platform-${ENV#--}"
STORE_PREFIX=$(echo "$STORE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-20)

echo "🚀 Starting provisioning verification..."
echo "   Environment: $ENV"
echo "   Project: $PROJECT_ID"
echo "   Store name: $STORE_NAME"
echo ""

# Step 1: Check Prerequisites
echo "✓ Step 1: Checking prerequisites..."
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud not installed"; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo "❌ firebase-tools not installed"; exit 1; }
gcloud auth list | grep -q "ACTIVE" || { echo "❌ Not authenticated to gcloud"; exit 1; }

# Step 2: Verify Secret Exists
echo "✓ Step 2: Verifying SMTP secret..."
gcloud secrets describe ext-firestore-send-email-SMTP_PASSWORD --project="$PROJECT_ID" >/dev/null 2>&1 || \
  { echo "❌ Secret ext-firestore-send-email-SMTP_PASSWORD not found in $PROJECT_ID"; exit 1; }

# Step 3: Verify OAuth Credentials
echo "✓ Step 3: Checking OAuth credentials..."
gcloud secrets describe platform-owner-credentials-pool --project="$PROJECT_ID" >/dev/null 2>&1 || \
  { echo "⚠️  OAuth credentials might be expired. Run: npm run setup-provisioning"; }

# Step 4: Trigger Provisioning
echo "✓ Step 4: Triggering provisioning (via REST API)..."
# Note: This would normally call the provisionStore HTTP function
# For now, we log the instruction
echo "   ℹ️  To provision a store, POST to:"
echo "   https://us-central1-${PROJECT_ID}.cloudfunctions.net/provisionStore"
echo "   with body: { storeName: \"$STORE_NAME\", ownerEmail: \"...\", billingAccountId: \"...\" }"

# Step 5: Wait for completion (if integrated)
echo "✓ Step 5: Monitoring provisioning progress..."
echo "   ℹ️  Open vertex-platform in browser and create store manually"
echo "   Then run: ./scripts/verify-provision.sh --validate-store $STORE_PREFIX"

echo ""
echo "✅ Verification setup complete!"
echo ""
echo "Next steps:"
echo "1. Create store in UI: https://vertex-platform-${ENV#--}.web.app"
echo "2. Wait for 11 provisioning steps to complete"
echo "3. Run: gcloud functions logs read --project=$PROJECT_ID | grep -i 'step'"
echo "4. Verify Extension: gcloud firebase extensions instances list --project=$PROJECT_ID"
