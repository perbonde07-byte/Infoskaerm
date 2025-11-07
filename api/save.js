// Vercel serverless function: Gemmer data.json i GitHub repo.
// Kræver env: ADMIN_PIN, OWNER, REPO, BRANCH, FILEPATH, GITHUB_TOKEN

export const config = { runtime: 'nodejs20' };

const {
  ADMIN_PIN = '',
  OWNER = '',
  REPO = '',
  BRANCH = 'main',
  FILEPATH = 'data.json',
  GITHUB_TOKEN = '',
} = process.env;

async function getSha(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'infoskaerm' },
    cache: 'no-store'
  });
  if (r.status === 404) return null;
  const j = await r.json();
  return j.sha || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!req.headers['x-admin-pin'] || req.headers['x-admin-pin'] !== ADMIN_PIN) {
      return res.status(401).json({ error: 'PIN forkert' });
    }
    if (!OWNER || !REPO || !GITHUB_TOKEN) return res.status(500).json({ error: 'Manglende ENV' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const content = Buffer.from(JSON.stringify(body, null, 2), 'utf8').toString('base64');
    const sha = await getSha(FILEPATH);

    const resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'infoskaerm',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update data.json',
        content,
        sha: sha || undefined,
        branch: BRANCH,
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).send(t);
    }

    const j = await resp.json();
    return res.status(200).json({ ok: true, commit: j.commit?.sha });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}



