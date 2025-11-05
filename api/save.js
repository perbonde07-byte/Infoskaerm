// api/save.js
// Gemmer hele JSON-body som FILEPATH på BRANCH i OWNER/REPO
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, FILEPATH

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // Tjek env vars
  const required = ['GITHUB_TOKEN', 'OWNER', 'REPO', 'BRANCH', 'FILEPATH'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required ENV vars: ${missing.join(', ')}` });
  }

  const token   = process.env.GITHUB_TOKEN;
  const OWNER   = process.env.OWNER;
  const REPO    = process.env.REPO;
  const BRANCH  = process.env.BRANCH;
  const FILEPATH= process.env.FILEPATH;

  try {
    // Sørg for at vi har et objekt som kan serialiseres
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        // hvis det er ren tekst, gemmer vi som tekst
        payload = { raw: payload };
      }
    }

    const contentBase64 = Buffer
      .from(JSON.stringify(payload, null, 2), 'utf8')
      .toString('base64');

    // 1) Find eksisterende sha (hvis filen allerede findes)
    let sha = null;
    {
      const r = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(FILEPATH)}?ref=${encodeURIComponent(BRANCH)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if


