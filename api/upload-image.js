// Upload base64-billede til /media/<name> i repo.
// Kræver env: ADMIN_PIN, OWNER, REPO, BRANCH, MEDIA_DIR, GITHUB_TOKEN

export const config = { runtime: 'nodejs20' };

const {
  ADMIN_PIN = '',
  OWNER = '',
  REPO = '',
  BRANCH = 'main',
  MEDIA_DIR = 'media',
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
    const { name, data } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    if (!name || !data) return res.status(400).json({ error: 'name og data påkrævet' });

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${MEDIA_DIR}/${safeName}`;

    const sha = await getSha(path);
    const resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'infoskaerm',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Upload ${safeName}`,
        content: data, // allerede base64 fra klienten
        sha: sha || undefined,
        branch: BRANCH,
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).send(t);
    }

    const rawUrl = `https://${OWNER}.github.io/${REPO}/${MEDIA_DIR}/${encodeURIComponent(safeName)}`;
    return res.status(200).json({ ok: true, rawUrl });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}





