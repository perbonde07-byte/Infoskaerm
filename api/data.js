export default async function handler(req, res) {
  try {
    const token  = process.env.GITHUB_TOKEN;
    const owner  = process.env.OWNER;
    const repo   = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const path   = process.env.FILEPATH || 'data.json';

    if (!owner || !repo) return res.status(400).json({ error: 'Missing OWNER/REPO env' });

    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'infoscreen' } }
    );
    if (!r.ok) return res.status(r.status).json({ error: `GitHub API ${r.status}` });

    const file = await r.json();
    const json = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ sha: file.sha, data: json });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

