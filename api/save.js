// Pb-desigen: /api/save – gemmer data.json eller sletter filer i repoet
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error:'Kun POST' });
      return;
    }
    const pin = (req.body && req.body.pin) || '';
    const adminPin = process.env.ADMIN_PIN || '';
    if (String(pin) !== String(adminPin)) {
      res.status(401).json({ error:'Forkert PIN' });
      return;
    }

    const owner = process.env.OWNER;
    const repo = process.env.REPO;
    const branch = process.env.BRANCH || 'main';
    const filepath = process.env.FILEPATH || 'data.json';
    const token = process.env.GITHUB_TOKEN;

    const ghHeaders = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    // Pb-desigen: SLET FILER
    if (Array.isArray(req.body.deletePaths) && req.body.deletePaths.length) {
      const results = [];
      for (const relPath of req.body.deletePaths) {
        const path = String(relPath).replace(/^\/+/,'');
        // hent SHA
        const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,{ headers: ghHeaders });
        if (!meta.ok) {
          results.push({ path, ok:false, error:`Meta fejl ${meta.status}` });
          continue;
        }
        const info = await meta.json();
        const sha = info.sha;
        // delete via PUT (content API)
        const del = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,{
          method:'PUT', headers: ghHeaders,
          body: JSON.stringify({
            message: `Delete ${path} (admin)`,
            sha, branch, committer:{name:'Infoskærm',email:'no-reply@bredsgaard.dk'}
          })
        });
        results.push({ path, ok: del.ok, status: del.status });
      }
      res.status(200).json({ deleted: results });
      return;
    }

    // Pb-desigen: GEM data.json
    const data = req.body && req.body.data;
    if (!data) { res.status(400).json({ error:'Mangler data' }); return; }

    // hent nuværende sha
    const shaResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filepath}?ref=${branch}`,{ headers: ghHeaders });
    const shaJson = await shaResp.json().catch(()=>({}));
    const sha = shaJson && shaJson.sha ? shaJson.sha : undefined;

    const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`,{
      method:'PUT', headers: ghHeaders,
      body: JSON.stringify({
        message:'Update data.json (admin)',
        content: Buffer.from(JSON.stringify(data,null,2)).toString('base64'),
        sha, branch, committer:{name:'Infoskærm',email:'no-reply@bredsgaard.dk'}
      })
    });
    if(!put.ok){
      const t = await put.text();
      res.status(500).json({ error:'Kunne ikke gemme', detail:t });
      return;
    }
    res.status(200).json({ ok:true });
  } catch (e) {
    res.status(500).json({ error: e.message||'Ukendt fejl' });
  }
}

