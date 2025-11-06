// api/save.js
// Gemmer hele JSON-body som FILEPATH på BRANCH i OWNER/REPO
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, FILEPATH

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const miss = ['GITHUB_TOKEN','OWNER','REPO','BRANCH','FILEPATH'].filter(k => !process.env[k]);
  if (miss.length) return res.status(400).json({ error: `Missing required ENV vars: ${miss.join(', ')}` });

  try {
    const token = process.env.GITHUB_TOKEN;
    const OWNER = process.env.OWNER;
    const REPO = process.env.REPO;
    const BRANCH = process.env.BRANCH;
    const FILEPATH = process.env.FILEPATH;

    const content = Buffer.from(JSON.stringify(req.body, null, 2)).toString('base64');

    // find sha hvis fil findes
    let sha = null;
    {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}?ref=${encodeURIComponent(BRANCH)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
      });
      if (r.ok) sha = (await r.json()).sha;
    }

    const put = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: sha ? `Update ${FILEPATH}` : `Create ${FILEPATH}`,
        content, branch: BRANCH, ...(sha ? { sha } : {})
      })
    });

    if (!put.ok) {
      const detail = await put.text();
      return res.status(put.status).json({ error: 'GitHub update failed', detail });
    }
    const out = await put.json();
    return res.status(200).json({ ok: true, path: out.content?.path || FILEPATH });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
