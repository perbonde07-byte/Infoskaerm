// api/save.js
// Gemmer data.json i GitHub repo'et via GitHub REST API v3
// ENV: ADMIN_PIN, GITHUB_TOKEN, OWNER, REPO, (valgfri) BRANCH, (valgfri) FILEPATH

export const config = { runtime: "nodejs" };

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  // ====== 1) Tjek admin-session-cookie ======
  const ok = isSessionValid(req);
  if (!ok) return res.status(401).send("Unauthorized (session)");

  // ====== 2) Læs payload ======
  const body = await readRaw(req);
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return res.status(400).send("Bad JSON");
  }

  // ====== 3) Opsæt repo-parametre ======
  const token  = process.env.GITHUB_TOKEN || "";
  const owner  = process.env.OWNER || "";
  const repo   = process.env.REPO || "";
  const branch = process.env.BRANCH || "main";
  const path   = process.env.FILEPATH || "data.json";

  if (!token || !owner || !repo) {
    return res.status(500).send("ENV mangler (GITHUB_TOKEN/OWNER/REPO)");
  }

  // ====== 4) Hent nuværende SHA for filen (kræves af GitHub API) ======
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "infoskaerm-admin"
  };

  let sha = undefined;
  try {
    const cur = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
    if (cur.status === 200) {
      const j = await cur.json();
      sha = j.sha;
    }
  } catch (_) { /* ignorer */ }

  // ====== 5) PUT ny version ======
  const content = Buffer.from(JSON.stringify(json, null, 2), "utf8").toString("base64");
  const message = `update data.json (${new Date().toISOString()})`;

  const putRes = await fetch(baseUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message, content, branch, sha })
  });

  if (!putRes.ok) {
    const txt = await safeText(putRes);
    return res.status(putRes.status).send(txt || "GitHub PUT fejl");
  }

  return res.status(200).send("OK");
}

// ---------- helpers ----------
function isSessionValid(req) {
  try {
    const expected = process.env.ADMIN_PIN || "";
    if (!expected) return false;
    const want = crypto.createHmac("sha256", expected).update("allow").digest("hex");
    const got = parseCookie(req.headers?.cookie || "")["admin_session"] || "";
    return got && got === want;
  } catch {
    return false;
  }
}

function parseCookie(s) {
  const out = {};
  s.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function safeText(r) {
  try { return await r.text(); } catch { return ""; }
}



