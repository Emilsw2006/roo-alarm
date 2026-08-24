#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_REF="lrzucapbjfufwdpishdm"

echo "→ Desplegando verify-mission-photo en ${PROJECT_REF}..."
echo "  (Los secrets del dashboard se cargan al desplegar.)"
npx supabase functions deploy verify-mission-photo --project-ref "${PROJECT_REF}"

echo "→ Probando función..."
node - <<'NODE'
require('dotenv').config({ path: '.env.local' });
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const tinyB64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
fetch(url + '/functions/v1/verify-mission-photo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, apikey: key },
  body: JSON.stringify({ missionId: 'water', missionLabel: 'Agua', missionHint: 'vaso', imageBase64: tinyB64 }),
}).then(async (r) => {
  console.log('status', r.status);
  console.log(await r.text());
});
NODE
