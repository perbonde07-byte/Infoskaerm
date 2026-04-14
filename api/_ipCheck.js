export function getClientIp(req) {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "";

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
}

export function isAllowedIp(req) {
  const allowed = (process.env.ALLOWED_IPS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const ip = getClientIp(req);

  return allowed.includes(ip);
}

export function deny(res) {
  return res.status(403).json({
    ok: false,
    error: "Adgang nægtet"
  });
}
