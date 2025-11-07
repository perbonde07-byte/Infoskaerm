// api/save.js
// Minimal serverless "Gem data.json til GitHub" + PIN-beskyttelse.
// Kræver env vars: ADMIN_PIN, GITHUB_TOKEN, OWNER, REPO, BRANCH, FILEPATH
// Eksempel: OWNER=perbonde07-byte, REPO=Infoskaerm, BRANCH=main, FILEPATH=data.json

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Only POST allowed' });
    }

    // PIN-kontrol (samme som du taster i admin)
    const pinHeader = req.headers['x-admin-pin'] || '';
    const ADMIN_PIN = process.env.ADMIN_PIN || '';
    if (!ADMIN_PIN || pinHeader !== ADMIN_PIN) {
      return res.status(401).json({ error: 'Unauthorized (PIN)' });
    }

    const bodyText = await readBody(req);
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const OWNER   = process.env.OWNER;     // fx "perbonde07-byte"
    const REPO    = process.env.REPO;      // fx "Infoskaerm"
    const BRANCH  = process.env.BRANCH || 'main';
    const FILE    = process.env.FILEPATH || 'data.json';
    const TOKEN   = process.env.GITHUB_TOKEN;

    if (!OWNER || !REPO || !TOKEN) {
      return res.status(500).json({ error: 'Missing env vars (OWNER/REPO/GITHUB_TOKEN)' });
    }

    // 1) Hent eksisterende SHA (krævet for at opdatere via GitHub Contents API)
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE)}?ref=${encodeURIComponent(BRANCH)}`;
    let sha = null;
    const getResp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json' }
    });

    if (getResp.ok) {
      const j = await getResp.json();
      sha = j.sha || null;
    } else if (getResp.status !== 404) {
      const t = await getResp.text();
      return res.status(502).json({ error: 'GitHub read failed', detail: t });
    }

    // 2) PUT ny fil (eller update) med base64-indhold
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILE)}`;
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');

    const putBody = {
      message: 'Update data.json via /api/save',
      content,
      branch: BRANCH
    };
    if (sha) putBody.sha = sha;

    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putResp.ok) {
      const txt = await putResp.text();
      return res.status(502).json({ error: 'GitHub write failed', detail: txt });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}

// Hjælper til at læse rå body (Vercel Node runtime)
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}
