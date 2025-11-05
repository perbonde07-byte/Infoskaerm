// api/save.js
// Gemmer data.json i dit GitHub-repo via GitHub Contents API

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const {
      GITHUB_TOKEN,
      OWNER,
      REPO,
      BRANCH = 'main',
      FILEPATH = 'data.json',
    } = process.env;

    if (!GITHUB_TOKEN || !OWNER || !REPO) {
      return res.status(500).json({ error: 'Missing required ENV vars' });
    }

    const incoming = await req.json?.() || await (async () => {
      try { return await req.body?.json(); } catch { return null; }
    })();

    // Hvis admin sender raw body (fetch body: JSON.stringify(...))
    const bodyData = incoming || req.body || null;
    if (!bodyData) {
      // Hvis Vercel allerede parse’r json: req.body er objekt
      if (!req.body) {
        return res.status(400).json({ error: 'No JSON payload' });
      }
    }

    const contentObj = bodyData || req.body;
    const contentString = JSON.stringify(contentObj, null, 2);
    const contentBase64 = Buffer.from(contentString).toString('base64');

    // 1) Find nuværende SHA (hvis filen findes)
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}?ref=${encodeURIComponent(BRANCH)}`;
    let sha = null;

    const getResp = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (getResp.ok) {
      const existing = await getResp.json();
      sha = existing?.sha || null;
    } else if (getResp.status !== 404) {
      const txt = await getResp.text();
      return res.status(400).json({ error: 'Cannot check existing file', detail: txt });
    }

    // 2) PUT det nye indhold
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}`;
    const putBody = {
      message: `Update ${FILEPATH} via admin UI`,
      content: contentBase64,
      branch: BRANCH,
      sha,
    };

    const putResp = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(putBody),
    });

    if (!putResp.ok) {
      const detail = await putResp.text();
      return res.status(400).json({ error: 'GitHub update failed', detail });
    }

    const result = await putResp.json();
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
