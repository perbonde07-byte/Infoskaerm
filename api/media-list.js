// /api/media-list.js
// Returnerer liste over billedfiler i MEDIA_DIR på BRANCH i OWNER/REPO
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, MEDIA_DIR

export default async function handler(req, res) {
  const miss = ['GITHUB_TOKEN','OWNER','REPO','BRANCH','MEDIA_DIR'].filter(k => !process.env[k]);
  if (miss.length) return res.status(400).json({ error: `Missing required ENV vars: ${miss.join(', ')}` });

  const token  = process.env.GITHUB_TOKEN;
  const OWNER  = process.env.OWNER;
  const REPO   = process.env.REPO;
  const BRANCH = process.env.BRANCH;
  const DIR    = process.env.MEDIA_DIR;

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(DIR)}?ref=${encodeURIComponent(BRANCH)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });

    if (r.status === 404) {
      // Mappen findes ikke endnu
      return res.status(200).json({ items: [] });
    }
    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: 'List failed', detail });
    }

    const arr = await r.json();
    const items = (Array.isArray(arr) ? arr : [])
      .filter(x => x?.type === 'file')
      .filter(x => /\.(png|jpe?g|gif|webp|svg)$/i.test(x.name))
      .map(x => ({
        name: x.name,
        size: x.size,
        // Brug raw.githubusercontent.com til direkte billede-URL
        url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DIR}/${encodeURIComponent(x.name)}`
      }));

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
