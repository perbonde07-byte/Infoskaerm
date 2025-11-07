// Returnerer en simpel liste over filer i /media via GitHub Contents API.

export const config = { runtime: 'nodejs20' };

const { OWNER = '', REPO = '', BRANCH = 'main', MEDIA_DIR = 'media' } = process.env;

export default async function handler(req, res) {
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(MEDIA_DIR)}?ref=${BRANCH}`, {
      headers: { 'User-Agent': 'infoskaerm' },
      cache: 'no-store'
    });
    if (r.status === 404) return res.status(200).json({ files: [] });
    const list = await r.json();
    const files = (Array.isArray(list) ? list : []).filter(x => x.type === 'file').map(x => ({
      name: x.name,
      path: x.path,
      size: x.size,
      url: `https://${OWNER}.github.io/${REPO}/${x.path}`
    }));
    res.status(200).json({ files });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
