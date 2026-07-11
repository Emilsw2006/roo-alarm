#!/usr/bin/env node
/**
 * Genera el Secret Key (JWT) para Supabase → Apple OAuth.
 *
 * Uso:
 *   node scripts/generate-apple-oauth-secret.mjs ~/Downloads/AuthKey_8GUN943X5C.p8
 *
 * El archivo .p8 lo descargas una sola vez desde Apple Developer → Keys.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TEAM_ID = 'YW6HVLQ9JV';
const KEY_ID = '8GUN943X5C';
const CLIENT_ID = 'com.roo.alarm.service';

const p8Path = process.argv[2];
if (!p8Path) {
  console.error('Uso: node scripts/generate-apple-oauth-secret.mjs <ruta-al-archivo.p8>');
  process.exit(1);
}

const resolved = path.resolve(p8Path);
if (!fs.existsSync(resolved)) {
  console.error(`No existe el archivo: ${resolved}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(resolved, 'utf8');

function base64url(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = { alg: 'ES256', kid: KEY_ID };
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 86400 * 180,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
const sign = crypto.createSign('SHA256');
sign.update(signingInput);
sign.end();
const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

const jwt = `${signingInput}.${base64url(signature)}`;
console.log('\nPega esto en Supabase → Authentication → Providers → Apple → Secret Key:\n');
console.log(jwt);
console.log('\n(Válido ~180 días; renueva antes de 6 meses)\n');
