// api/media-list.js
// Returnerer liste over billedfiler i en repo-mappe (fx "media/")

export default async function handler(req, res) {
  try {
    const {
      GITHUB_TOKEN,
      OWNER,
      REPO,
      BRANCH = 'main',
      MEDIA_DIR = 'media',
    } = process.env;

    if (!GITHUB_TOKEN || !OWNER || !REPO) {
      return res.status(500).json({ error: 'Missing required ENV vars' });
    }

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(MEDIA_DIR)}?ref=${encodeURIComponent(BRANCH)}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (resp.status === 404) {
      // Mappen findes ikke (tom liste)
      return res.status(200).json({ items: [] });
    }

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(400).json({ error: 'list failed', detail: txt });
    }

    const arr = await resp.json(); // array af filer/dirs
    const files = Array.isArray(arr) ? arr : [];

    // Kun filer, lav raw URL’er:
    const items = files
      .filter(x => x.type === 'file')
      .map(x => ({
        name: x.name,
        size: x.size,
        url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodeURIComponent(MEDIA_DIR)}/${encodeURIComponent(x.name)}`
      }));

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

