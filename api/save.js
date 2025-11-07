// api/save.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const pin = req.headers["x-admin-pin"];
  const correctPin = process.env.ADMIN_PIN || "";

  if (!pin || pin !== correctPin) {
    return res.status(401).send("Unauthorized (PIN)");
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.OWNER;
    const repo = process.env.REPO;
    const branch = process.env.BRANCH || "main";
    const path = process.env.FILEPATH || "data.json";

    if (!token || !owner || !repo) {
      return res.status(500).json({ error: "Missing GitHub environment variables" });
    }

    const body = req.body || {};
    const content = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");

    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Hent nuværende SHA
    const getResp = await fetch(`${baseUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "infoskaerm",
        Accept: "application/vnd.github+json",
      },
    });

    let sha;
    if (getResp.status === 200) {
      const j = await getResp.json();
      sha = j.sha;
    }

    // Commit ny version
    const putResp = await fetch(baseUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "infoskaerm",
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Update data.json via admin",
        content,
        branch,
        sha,
      }),
    });

    if (!putResp.ok) {
      const txt = await putResp.text();
      return res.status(500).send(`GitHub error: ${txt}`);
    }

    return res.status(200).send("OK");
  } catch (e) {
    return res.status(500).send(e.message);
  }
}




