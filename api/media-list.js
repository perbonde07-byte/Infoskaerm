export default async function handler(req, res) {
  try {
    const { OWNER, REPO, BRANCH, GITHUB_TOKEN, MEDIA_DIR = 'media' } = process.env;

    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
    if (!OWNER || !REPO || !BRANCH || !GITHUB_TOKEN) {
      return res.status(500).json({ error: 'Missing env vars' });
    }

    const ghUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${MEDIA_DIR}?ref=${BRANCH}`;
    const resp = await fetch(ghUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(resp.status).json({ error: 'GitHub list failed', detail: t });
    }

    const items = await resp.json();
    const files = (Array.isArray(items) ? items : [])
      .filter(x => x.type === 'file')
      .map(x => ({
        name: x.name,
        size: x.size,
        raw: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${MEDIA_DIR}/${encodeURIComponent(x.name)}`
      }));

    res.status(200).json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
