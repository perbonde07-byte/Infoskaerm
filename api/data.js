// Pb-desigen: /api/data – henter data.json og kan liste filer i repo mapper
export default async function handler(req, res) {
  try {
    const owner = process.env.OWNER;
    const repo = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const filepath = process.env.FILEPATH || 'data.json';
    const token = process.env.GITHUB_TOKEN;

    const { action, dir } = req.query || {};

    // Pb-desigen: List filer i /medarbejdere eller /media
    if (action === 'list') {
      const allow = ['medarbejdere','media'];
      const folder = String(dir||'').replace(/^\/+/,'');
      if (!allow.includes(folder)) {
        res.status(400).json({ error: 'Ugyldig mappe' });
        return;
      }
      const gh = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${folder}?ref=${branch}`,{
        headers:{'Authorization':`token ${token}`,'Accept':'application/vnd.github+json'}
      });
      if (!gh.ok) {
        const t = await gh.text();
        res.status(500).json({ error:'Kunne ikke liste filer', detail:t });
        return;
      }
      const arr = await gh.json();
      const files = (arr||[])
        .filter(x=>x.type==='file')
        .map(x=>({
          path: x.path,
          raw: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${x.path}`
        }));
      res.status(200).json({ files });
      return;
    }

    // Pb-desigen: Default – hent data.json
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`,{
      headers:{'Authorization':`token ${token}`}
    });
    if(!r.ok){ throw new Error('Kan ikke hente data.json'); }
    const data = await r.json();
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message||'Ukendt fejl' });
  }
}


