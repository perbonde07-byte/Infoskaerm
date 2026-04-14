export function getClientIp(req) {
  try {
    const xff = req.headers["x-forwarded-for"] || "";
    const ip = xff.split(",")[0].trim();

    if (!ip) return "";

    return ip.replace("::ffff:", "");
  } catch (e) {
    return "";
  }
}

export function parseAllowList() {
  const raw = process.env.ALLOWED_IPS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedIp(req) {
  const clientIp = getClientIp(req);
  const allowList = parseAllowList();

  if (!allowList.length) return false;

  return allowList.some((allowed) => {
    if (clientIp === allowed) return true;

    if (allowed.includes("/24")) {
      const base = allowed.split("/")[0];
      const a = base.split(".");
      const b = clientIp.split(".");
      return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }

    return false;
  });
}

export function deny(res) {
  return res.status(403).json({ error: "Adgang nægtet" });
}
