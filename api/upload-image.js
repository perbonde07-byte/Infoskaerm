// api/upload-image.js
// Upload et billede til GitHub (mappen MEDIA_DIR). Kræver env vars:
// GITHUB_TOKEN, OWNER, REPO, BRANCH, MEDIA_DIR

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } } // tillad større uploads
};

function missing(...names) {
  const miss = names.filter(n => !process.env[n]);
  return miss.length ? `Missing required ENV vars: ${miss.join(', ')}` : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const err = missing('GITHUB_TOKEN', 'OWNER', 'REPO', 'BRANCH', 'MEDIA_DIR');
  if (err) return res.status(400).json({ error: err });

  try {
    const { name, data } = await req.body instanceof Object ? req.body : JSON.parse(req.body || '{}');
    if (!name || !data) {
      return res.status(400).json({ error: 'Missing {name, data}' });
    }

    const OWNER = process.env.OWNER;
    const REPO = process.env.REPO;
    const BRANCH = process.env.BRANCH;
    const MEDIA_DIR = process.env.MEDIA_DIR;
    const token = process.env.GITHUB_TOKEN;

    // Byg sti i repoet
    const path = `${MEDIA_DIR.replace(/\/+$/,'')}/${name}`;

    // Tjek om filen allerede findes (så vi kan sende sha ved update)
    let existingSha = null;
    {
      const check = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      );
      if (check.ok) {
        const j = await check.json();
        existingSha = j.sha;
      }
    }

    // GitHub Contents API forventer base64; klienten sender allerede base64 (uden data: prefix)
    const commitMessage = existingSha ? `Update image ${name}` : `Add image ${name}`;
    const payload = {
      message: commitMessage,
      content: data,         // base64
      branch: BRANCH,
      ...(existingSha ? { sha: existingSha } : {})
    };

    const put = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!put.ok) {
      const detail = await put.text();
      return res.status(put.status).json({ error: 'GitHub upload failed', detail });
    }

    // Byg en rå URL til billedet
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${path}`;

    return res.status(200).json({ ok: true, path, rawUrl, cdnUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
