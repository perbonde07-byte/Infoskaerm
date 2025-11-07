export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const adminPin = process.env.ADMIN_PIN;
    const sentPin  = req.headers['x-admin-pin'] || req.body?.pin;
    if (adminPin && String(sentPin) !== String(adminPin)) {
      return res.status(401).json({ error: 'Unauthorized (PIN)' });
    }

    const token  = process.env.GITHUB_TOKEN;
    const owner  = process.env.OWNER;
    const repo   = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const path   = process.env.FILEPATH || 'data.json';

    if (!token || !owner || !repo) {
      return res.status(400).json({ error: 'Missing envs: GITHUB_TOKEN/OWNER/REPO' });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'infoscreen'
    };

    // Hent nuværende SHA (optimistisk låsning)
    let sha = undefined;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const getRes = await fetch(getUrl, { headers });
    if (getRes.status === 200) {
      const file = await getRes.json();
      sha = file.sha;
    }

    const incoming = req.body?.data;
    if (!incoming) return res.status(400).json({ error: 'Missing body.data' });

    const content = Buffer.from(JSON.stringify(incoming, null, 2)).toString('base64');

    // Skriv til GitHub
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'chore: update data.json via admin',
        content,
        sha,
        branch
      })
    });

    const jr = await putRes.json();
    if (!putRes.ok) return res.status(putRes.status).json(jr);

    return res.status(200).json({ ok: true, content: jr.content });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}





