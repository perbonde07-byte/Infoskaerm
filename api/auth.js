// api/auth.js
// Godkender PIN og sætter en HttpOnly-cookie i 24 timer

export const config = { runtime: "nodejs" };

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const expected = process.env.ADMIN_PIN || "";
    if (!expected) {
      return res.status(500).json({ error: "ADMIN_PIN mangler i Vercel" });
    }

    const body = await readJson(req);
    const pin = String(body?.pin || "");

    if (pin !== String(expected)) {
      return res.status(401).json({ error: "Forkert kode" });
    }

    // Stateles cookie-signatur: HMAC(admin_pin, "allow")
    const sig = crypto.createHmac("sha256", expected).update("allow").digest("hex");

    // Sæt HttpOnly cookie (24 timer). SameSite=Lax virker på vercel.app.
    const cookie = [
      `admin_session=${sig}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=86400"
      // Ingen "Secure" så det også virker på ikke-https previews.
    ].join("; ");

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Auth-fejl" });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch (e) { resolve({}); }
    });
    req.on("error", reject);
  });
}
