export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token  = process.env.GITHUB_TOKEN;
    const owner  = process.env.OWNER;
    const repo   = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const path   = process.env.FILEPATH || 'data.json';

    const body    = await req.json?.() || req.body;
    const dataStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    const content = Buffer.from(dataStr).toString('base64');

    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    let sha = null;
    const getResp = await fetch(getUrl, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' }});
    if (getResp.ok) sha = (await getResp.json()).sha;

    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Update data.json via admin', content, sha, branch })
    });

    if (!putResp.ok) return res.status(400).json({ error: 'GitHub update failed', detail: await putResp.text() });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
