export const config = { runtime: 'nodejs' };


// api/media-list.js
// ENV: GITHUB_TOKEN, OWNER, REPO, BRANCH, MEDIA_DIR

export default async function handler(req, res) {
  const need=['GITHUB_TOKEN','OWNER','REPO','BRANCH','MEDIA_DIR'];
  const miss=need.filter(k=>!process.env[k]);
  if(miss.length) return res.status(400).json({error:`Missing required ENV vars: ${miss.join(', ')}`});

  try{
    const token=process.env.GITHUB_TOKEN;
    const OWNER=process.env.OWNER;
    const REPO=process.env.REPO;
    const BRANCH=process.env.BRANCH;
    const DIR=process.env.MEDIA_DIR.replace(/\/+$/,'');

    const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(DIR)}?ref=${encodeURIComponent(BRANCH)}`,{
      headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}
    });

    if(r.status===404) return res.status(200).json({items:[]});
    if(!r.ok){ const detail=await r.text(); return res.status(r.status).json({error:'list failed',detail}); }

    const arr=await r.json();
    const items=(Array.isArray(arr)?arr:[]).filter(x=>x.type==='file').map(x=>({
      name:x.name, size:x.size, url:`https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${DIR}/${x.name}`
    }));

    return res.status(200).json({items});
  }catch(e){ return res.status(500).json({error:e.message||String(e)}); }
}

