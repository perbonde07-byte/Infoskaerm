// api/upload-image.js
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, MEDIA_DIR

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const need = ['GITHUB_TOKEN','OWNER','REPO','BRANCH','MEDIA_DIR'];
  const miss = need.filter(k => !process.env[k]);
  if (miss.length) return res.status(400).json({ error: `Missing required ENV vars: ${miss.join(', ')}` });

  try {
    const token  = process.env.GITHUB_TOKEN;
    const OWNER  = process.env.OWNER;
    const REPO   = process.env.REPO;
    const BRANCH = process.env.BRANCH;
    const DIR    = process.env.MEDIA_DIR.replace(/\/+$/,'');

    const body = (req.body && typeof req.body==='object') ? req.body : JSON.parse(req.body||'{}');
    const { name, data } = body;
    if (!name || !data) return res.status(400).json({ error: 'Missing {name, data}' });

    const path = `${DIR}/${name}`;

    // sha hvis findes
    let sha = null;
    {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
      });
      if (r.ok) sha = (await r.json()).sha;
    }

    const put = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: sha ? `Update image ${name}` : `Add image ${name}`,
        content: data, branch: BRANCH, ...(sha ? { sha } : {})
      })
    });

    if (!put.ok) {
      const detail = await put.text();
      return res.status(put.status).json({ error: 'GitHub upload failed', detail });
    }

    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${path}`;
    return res.status(200).json({ ok:true, path, rawUrl, cdnUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}

