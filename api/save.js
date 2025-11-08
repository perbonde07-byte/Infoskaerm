// /api/save.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Valgfri PIN
  const pinHeader = req.headers['x-admin-pin'];
  const envPin = process.env.ADMIN_PIN || '';
  if (envPin && pinHeader !== envPin) {
    return res.status(401).json({ error: 'Unauthorized (PIN)' });
  }

  try {
    const body = req.body || {};

    // -------- UPLOAD BILLEDE --------
    if (body.upload) {
      const { folder, filename, dataUrl } = body.upload || {};
      if (!folder || !filename || !dataUrl) {
        return res.status(400).json({ error: 'upload: folder, filename og dataUrl kræves' });
      }

      const owner  = process.env.OWNER;
      const repo   = process.env.REPO;
      const branch = process.env.BRANCH || 'main';
      const token  = process.env.GITHUB_TOKEN;

      if (!owner || !repo || !token) {
        return res.status(500).json({ error: 'Mangler OWNER/REPO/GITHUB_TOKEN env vars' });
      }

      // data:*;base64,XXXX
      const m = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
      if (!m) return res.status(400).json({ error: 'Ugyldigt dataUrl' });
      const base64 = m[2];

      const safeFolder = String(folder).replace(/^\/+|\/+$/g,'');  // fjern leading/trailing /
      const safeName   = String(filename).replace(/[^A-Za-z0-9._-]/g,'').replace(/^\.+/,'') || 'image.jpg';
      let   path       = `${safeFolder}/${safeName}`;

      // Hvis filen findes, lav -1, -2, ...
      const exists = await githubGetContent(owner, repo, path, token);
      let counter = 1;
      while (exists && counter < 50) {
        const dot = safeName.lastIndexOf('.');
        const base = dot>0 ? safeName.slice(0,dot) : safeName;
        const ext  = dot>0 ? safeName.slice(dot)   : '';
        const candidate = `${safeFolder}/${base}-${counter}${ext}`;
        const c = await githubGetContent(owner, repo, candidate, token);
        if (!c) { path = candidate; break; }
        counter++;
      }

      const commitMsg = `Upload image: ${path}`;
      await githubPutFile(owner, repo, path, base64, commitMsg, token, null, branch);

      return res.status(200).json({ ok: true, path: `/${path}` });
    }

    // -------- GEM data.json --------
    const data = body.data;
    const sha  = body.sha || null;

    if (!data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const owner  = process.env.OWNER;
    const repo   = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const path   = process.env.FILEPATH || 'data.json';
    const token  = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return res.status(500).json({ error: 'Mangler OWNER/REPO/GITHUB_TOKEN env vars' });
    }

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
    const commitMessage = `Update ${path}`;

    await githubPutFile(owner, repo, path, content, commitMessage, token, sha, branch);

    const latest = await githubGetContent(owner, repo, path, token);
    res.status(200).json({ ok: true, sha: latest?.sha, path: `/${path}` });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Serverfejl', message: String(e?.message || e) });
  }
}

/* ---------------- GitHub helpers ---------------- */

async function githubPutFile(owner, repo, path, base64Content, message, token, sha = null, branch = 'main') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const payload = {
    message,
    content: base64Content,
    branch
  };
  if (sha) payload.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${t}`);
  }
  return await r.json();
}

async function githubGetContent(owner, repo, path, token, ref = null) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub GET failed: ${r.status} ${t}`);
  }
  return await r.json();
}

