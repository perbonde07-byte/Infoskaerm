/**
 * ADGANGSKONTROL
 *
 * Denne fil begrænser adgang til siden via offentlige IP'er.
 *
 * IP'er ændres i Vercel:
 * Settings -> Environment Variables
 * ALLOWED_IPS=95.138.217.203
 */

import { NextResponse } from "next/server";

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();

  if (!first) return "";

  if (first.startsWith("::ffff:")) {
    return first.replace("::ffff:", "");
  }

  return first;
}

function parseAllowList() {
  const raw = process.env.ALLOWED_IPS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipMatches(clientIp, allowedIp) {
  if (!clientIp || !allowedIp) return false;

  if (clientIp === allowedIp) return true;

  if (allowedIp.includes("/")) {
    const parts = allowedIp.split("/");
    const base = parts[0];
    const cidr = Number(parts[1]);

    if (cidr === 32) return clientIp === base;

    if (cidr === 24) {
      const a = base.split(".");
      const b = clientIp.split(".");
      if (a.length !== 4 || b.length !== 4) return false;
      return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }
  }

  return false;
}

function isAllowed(clientIp, allowList) {
  return allowList.some((ip) => ipMatches(clientIp, ip));
}

export function middleware(req) {
  const pathname = req.nextUrl.pathname;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const clientIp = getClientIp(req);
  const allowList = parseAllowList();

  if (!allowList.length) {
    return new NextResponse("ALLOWED_IPS er ikke sat i Vercel", {
      status: 500,
    });
  }

  if (!isAllowed(clientIp, allowList)) {
    return new NextResponse("Adgang naegtet (kun internt netvaerk)", {
      status: 403,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/index.html",
    "/admin.html",
    "/kalender.html",
    "/api/:path*",
    "/medarbejdere/:path*",
    "/media/:path*",
  ],
};
