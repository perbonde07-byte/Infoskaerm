// api/data.js
// PB-DESIGN: GitHub helper API til at læse/skriv/liste/slette filer i repoet.
// Kræver ENV: OWNER, REPO, BRANCH, GITHUB_TOKEN

export default async function handler(req, res) {
  try {
    const { OWNER, REPO, BRANCH, GITHUB_TOKEN } = process.env;
    if (!OWNER || !REPO || !BRANCH || !GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, error: "Manglende ENV variabler (OWNER, REPO, BRANCH, GITHUB_TOKEN)" });
    }

    // PB-DESIGN: ensartet GitHub request
    const gh = async (url, init = {}) => {
      const r = await fetch(`https://api.github.com${url}`, {
        ...init,
        headers: {
          "Authorization": `token ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          ...(init.headers || {})
        }
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`GitHub ${r.status}: ${t || r.statusText}`);
      }
      return r;
    };

    // PB-DESIGN: få raw-url (til preview)
    const rawUrl = (path) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodeURI(path)}`;

    if (req.method === "GET") {
      // PB-DESIGN: hent hele data.json (standard)
      const filePath = req.query.path || process.env.FILEPATH || "data.json";
      const r = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}?ref=${BRANCH}`);
      const j = await r.json();
      const content = Buffer.from(j.content, "base64").toString("utf8");
      return res.json({ ok: true, path: filePath, sha: j.sha, content: JSON.parse(content) });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: "Mangler action" });

    // ---------- DATA.JSON SAVE ----------
    if (action === "saveDataJson") {
      // PB-DESIGN: gem data.json atomisk
      const filePath = process.env.FILEPATH || "data.json";
      const current = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}?ref=${BRANCH}`).then(r => r.json());
      const newContent = Buffer.from(JSON.stringify(req.body.data, null, 2), "utf8").toString("base64");
      const put = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(filePath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || "PB-DESIGN: admin – opdater data.json",
          content: newContent,
          sha: current.sha,
          branch: BRANCH
        })
      }).then(r => r.json());
      return res.json({ ok: true, path: filePath, sha: put.content?.sha });
    }

    // ---------- FILHÅNDTERING (CRUD) ----------
    // PB-DESIGN: list indhold i en mappe
    if (action === "listDir") {
      const dir = (req.body.path || "").replace(/^\/+/, "");
      const j = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(dir)}?ref=${BRANCH}`).then(r => r.json());
      const items = (Array.isArray(j) ? j : []).map(x => ({
        name: x.name,
        path: x.path,
        type: x.type,
        size: x.size,
        raw: rawUrl(x.path)
      }));
      return res.json({ ok: true, items });
    }

    // PB-DESIGN: slet en fil (ikke mappe)
    if (action === "deletePath") {
      const path = (req.body.path || "").replace(/^\/+/, "");
      const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`).then(r => r.json());
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || `PB-DESIGN: slet ${path}`,
          sha: cur.sha,
          branch: BRANCH
        })
      });
      return res.json({ ok: true });
    }

    // PB-DESIGN: upload base64 (opret/overskriv)
    if (action === "uploadBase64") {
      const path = (req.body.path || "").replace(/^\/+/, "");
      const b64 = (req.body.base64 || "").replace(/^data:\w+\/[\w.+-]+;base64,/, "");
      // hent evt. eksisterende sha (overskriv)
      let sha = undefined;
      try {
        const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`).then(r => r.json());
        sha = cur.sha;
      } catch (_) {}
      const put = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || `PB-DESIGN: upload ${path}`,
          content: b64,
          sha,
          branch: BRANCH
        })
      }).then(r => r.json());
      return res.json({ ok: true, path, sha: put.content?.sha, raw: rawUrl(path) });
    }

    // PB-DESIGN: omdøb (kopi + slet)
    if (action === "renamePath") {
      const oldPath = (req.body.oldPath || "").replace(/^\/+/, "");
      const newPath = (req.body.newPath || "").replace(/^\/+/, "");
      const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(oldPath)}?ref=${BRANCH}`).then(r => r.json());
      const contentB64 = cur.content; // allerede base64
      // skriv ny
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(newPath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || `PB-DESIGN: rename ${oldPath} -> ${newPath}`,
          content: contentB64,
          branch: BRANCH
        })
      });
      // slet gammel
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(oldPath)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || `PB-DESIGN: remove old ${oldPath}`,
          sha: cur.sha,
          branch: BRANCH
        })
      });
      return res.json({ ok: true, from: oldPath, to: newPath, raw: rawUrl(newPath) });
    }

    return res.status(400).json({ ok: false, error: "Ukendt action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}



