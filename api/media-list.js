// api/media-list.js
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, MEDIA_DIR

export default async function handler(req, res) {
  const need = ['GITHUB_TOKEN','OWNER','REPO','BRANCH','MEDIA_DIR'];
  const miss = need.filter(k => !process.env[k]);
  if (miss.length) return res.status(400).json({ error: `Missing required ENV vars: ${miss.join(', ')}` });

  try{
    const token   = process.env.GITHUB_TOKEN;
    const OWNER   = process.env.OWNER;
    const REPO    = process.env.REPO;
    const BRANCH  = process.env.BRANCH;
    const MEDIA   = process.env.MEDIA_DIR.replace(/\/+$/,'');

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(MEDIA)}?ref=${encodeURIComponent(BRANCH)}`;
    const r = await fetch(url, { headers: { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' } });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error:'list failed', detail });
    }

    const itemsRaw = await r.json();  // array
    const items = (Array.isArray(itemsRaw) ? itemsRaw : [])
      .filter(x => x.type === 'file')
      .map(x => ({
        name: x.name,
        size: x.size,
        url: `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${MEDIA}/${x.name}`
      }));

    return res.status(200).json({ items });
  }catch(e){
    return res.status(500).json({ error: e.message || String(e) });
  }
}
