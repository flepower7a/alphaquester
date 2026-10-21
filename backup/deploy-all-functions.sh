#!/usr/bin/env bash
# Usage: bash backup/deploy-all-functions.sh YOUR_PROJECT_REF
# Needs: npx (Node.js). First run will ask you to log in to Supabase.
set -e
REF="$1"; [ -z "$REF" ] && { echo "Give project ref"; exit 1; }
npx supabase login
npx supabase functions deploy --project-ref "$REF" --no-verify-jwt
echo "All functions deployed with the same names."
