// File: api/auth.js
import crypto from 'crypto';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}
function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function makeToken(secret, ttlSeconds = 3600) { // 1 time
  const now = Math.floor(Date.now() / 1000);
  const data = { iat: now, exp: now + ttlSeconds };
  const payload = b64url(JSON.stringify(data));
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const expected = process.env.ADMIN_PIN || '';
    const { pin } = req.body || {};
    if (!expected || String(pin || '').trim() !== String(expected).trim()) {
      return res.status(401).json({ error: 'Forkert kode' });
    }

    const token = makeToken(expected, 24 * 3600); // 24 timer gyldig
    // Sæt HttpOnly session-cookie
    res.setHeader('Set-Cookie', [
      `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${24*3600}`
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e?.message || e) });
  }
}
