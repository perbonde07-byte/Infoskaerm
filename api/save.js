// api/save.js – gem data.json i GitHub og kræv admin-PIN
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const {
      OWNER, REPO, BRANCH = 'main', FILEPATH = 'data.json', GITHUB_TOKEN, ADMIN_PIN
    } = process.env;

    if (!OWNER || !REPO || !BRANCH || !FILEPATH || !GITHUB_TOKEN) {
      res.status(500).json({ error: 'Missing required ENV vars: OWNER, REPO, BRANCH, FILEPATH, GITHUB_TOKEN' });
      return;
    }

    // PIN-tjek
    const pinHeader = req.headers['x-admin-pin'] || req.headers['X-Admin-Pin'];
    if (!ADMIN_PIN || pinHeader !== ADMIN_PIN) {
      res.status(401).json({ error: 'Unauthorized (bad or missing PIN)' });
      return;
    }

    const body = await getBody(req);
    const content = Buffer.from(JSON.stringify(body, null, 2)).toString('base64');

    // Hent eksisterende blob sha (krævet af GitHub for at opdatere fil)
    const fileResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'infoskaerm' }
    });

    let sha = undefined;
    if (fileResp.status === 200) {
      const fileJson = await fileResp.json();
      sha = fileJson.sha;
    } else if (fileResp.status !== 404) {
      const t = await fileResp.text();
      res.status(500).json({ error: `Failed to read file: ${fileResp.status} ${t}` });
      return;
    }

    const commit = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`, {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'infoskaerm' },
      body: JSON.stringify({
        message: 'Update data.json',
        content,
        branch: BRANCH,
        sha
      })
    });

    if (!commit.ok) {
      const t = await commit.text();
      res.status(commit.status).json({ error: `GitHub write failed: ${t}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

