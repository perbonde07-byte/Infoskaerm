// File: api/save.js
import crypto from 'crypto';

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig !== expectedSig) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof data.exp !== 'number' || data.exp < now) return false;
    return true;
  } catch {
    return false;
  }
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith(name + '=')) return p.slice(name.length + 1);
  }
  return '';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 1) Cookie-auth (ingen PIN i request body/header)
    const secret = process.env.ADMIN_PIN || '';
    const token = readCookie(req, 'admin_session');
    if (!verifyToken(token, secret)) {
      return res.status(401).json({ error: 'Unauthorized (session)' });
    }

    // 2) Payload
    const body = req.body || {};
    const content = JSON.stringify(body, null, 2);

    // 3) GitHub ENV
    const tokenGH = process.env.GITHUB_TOKEN;
    const owner   = process.env.OWNER;
    const repo    = process.env.REPO;
    const branch  = process.env.BRANCH || 'main';
    const path    = process.env.FILEPATH || 'data.json';

    if (!tokenGH || !owner || !repo) {
      return res.status(500).json({ error: 'Missing env (GITHUB_TOKEN, OWNER, REPO)' });
    }

    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const headers = {
      'Authorization': `Bearer ${tokenGH}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'infoskaerm'
    };

    // Hent SHA hvis fil findes
    let sha;
    const getResp = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (getResp.status === 200) {
      const j = await getResp.json();
      sha = j.sha;
    } else if (getResp.status !== 404) {
      const t = await getResp.text();
      return res.status(502).json({ error: `GitHub GET failed (${getResp.status})`, detail: t });
    }

    // Commit
    const putResp = await fetch(baseUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'Update data.json via admin',
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        sha
      })
    });
    const putText = await putResp.text();
    if (!putResp.ok) {
      let msg = putText;
      try { const j = JSON.parse(putText); msg = j.message || putText; } catch {}
      return res.status(502).json({ error: `GitHub PUT failed (${putResp.status})`, detail: msg });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e?.message || e) });
  }
}


