// api/data.js
// PB-DESIGN: GitHub helper API til at læse/skriv/liste/slette filer i repoet.
// ENV: OWNER, REPO, BRANCH, GITHUB_TOKEN, FILEPATH (typisk "data.json")

const DEFAULTS = {
  brand: "Bredsgaard • Infoskærm",
  logoUrl: "/media/Bredsgaard-logo transparnt.png",
  theme: { bg1: "#0d4952", bg2: "#0b6a74", accent: "#a7d0c9" },
  settings: { refreshMs: 300000 },
  empties: {
    startDate: "",
    horizon: 8,
    weekdays: [1],       // 1=man..5=fre
    names: [],
    skipDates: [],
    columns: 2
  },
  birthdays: { message: "", people: [] },
  calendar: { url: "", daysAhead: 60, maxEvents: 50 },
  slides: [] // valgfrit (image/text/birthday/empties)
};

export default async function handler(req, res) {
  try {
    const { OWNER, REPO, BRANCH, GITHUB_TOKEN } = process.env;
    if (!OWNER || !REPO || !BRANCH || !GITHUB_TOKEN) {
      return res.status(500).json({ ok: false, error: "Manglende ENV variabler (OWNER, REPO, BRANCH, GITHUB_TOKEN)" });
    }
    const FILEPATH = process.env.FILEPATH || "data.json";

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

    const rawUrl = (path) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${encodeURI(path)}`;

    // ---------- GET: hent data.json (med defaults fallback)
    if (req.method === "GET") {
      try {
        const r = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(FILEPATH)}?ref=${BRANCH}`);
        const j = await r.json();
        const content = JSON.parse(Buffer.from(j.content, "base64").toString("utf-8"));
        // PB-DESIGN: merge bløde defaults så felter aldrig mangler
        const merged = deepMerge(DEFAULTS, content || {});
        return res.json({ ok: true, path: FILEPATH, sha: j.sha, content: merged });
      } catch (e) {
        // hvis fil mangler eller fejl: giv defaults (men returnér ok)
        return res.json({ ok: true, path: FILEPATH, sha: null, content: DEFAULTS, note: "PB-DESIGN: defaults fallback" });
      }
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ ok: false, error: "Mangler action" });

    // ---------- gem data.json
    if (action === "saveDataJson") {
      let sha = null;
      try {
        const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(FILEPATH)}?ref=${BRANCH}`).then(r => r.json());
        sha = cur.sha;
      } catch(_) {}
      const content = Buffer.from(JSON.stringify(req.body.data || DEFAULTS, null, 2), "utf-8").toString("base64");
      const put = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(FILEPATH)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: req.body.message || "PB-DESIGN: opdater data.json",
          content, sha, branch: BRANCH
        })
      }).then(r => r.json());
      return res.json({ ok: true, path: FILEPATH, sha: put.content?.sha });
    }

    // ---------- filer (CRUD)
    if (action === "listDir") {
      const dir = (req.body.path || "").replace(/^\/+/, "");
      const j = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(dir)}?ref=${BRANCH}`).then(r => r.json());
      const items = (Array.isArray(j) ? j : []).map(x => ({
        name: x.name, path: x.path, type: x.type, size: x.size, raw: rawUrl(x.path)
      }));
      return res.json({ ok: true, items });
    }

    if (action === "deletePath") {
      const path = (req.body.path || "").replace(/^\/+/, "");
      const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`).then(r => r.json());
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.body.message || `PB-DESIGN: slet ${path}`, sha: cur.sha, branch: BRANCH })
      });
      return res.json({ ok: true });
    }

    if (action === "uploadBase64") {
      const path = (req.body.path || "").replace(/^\/+/, "");
      const b64 = (req.body.base64 || "").replace(/^data:\w+\/[\w.+-]+;base64,/, "");
      let sha = undefined;
      try {
        const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`).then(r => r.json());
        sha = cur.sha;
      } catch(_) {}
      const put = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.body.message || `PB-DESIGN: upload ${path}`, content: b64, sha, branch: BRANCH })
      }).then(r => r.json());
      return res.json({ ok: true, path, sha: put.content?.sha, raw: rawUrl(path) });
    }

    if (action === "renamePath") {
      const oldPath = (req.body.oldPath || "").replace(/^\/+/, "");
      const newPath = (req.body.newPath || "").replace(/^\/+/, "");
      const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(oldPath)}?ref=${BRANCH}`).then(r => r.json());
      const contentB64 = cur.content;
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(newPath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.body.message || `PB-DESIGN: rename ${oldPath} -> ${newPath}`, content: contentB64, branch: BRANCH })
      });
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURI(oldPath)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: req.body.message || `PB-DESIGN: remove old ${oldPath}`, sha: cur.sha, branch: BRANCH })
      });
      return res.json({ ok: true, from: oldPath, to: newPath, raw: rawUrl(newPath) });
    }

    return res.status(400).json({ ok: false, error: "Ukendt action" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// PB-DESIGN: lille deep-merge til defaults
function deepMerge(base, add){
  if (Array.isArray(base)) return Array.isArray(add) ? add.slice() : base.slice();
  if (typeof base === "object" && base) {
    const out = { ...base };
    for (const k of Object.keys(add||{})) {
      out[k] = deepMerge(base[k], add[k]);
    }
    return out;
  }
  return (add === undefined ? base : add);
}
