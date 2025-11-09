// api/ics.js
// PB-DESIGN: Henter/pars­er ICS og returnerer kommende events (JSON).
// Brug: /api/ics?url=<ENCODET_ICS_URL>&days=60&max=50

let CACHE = { url: "", until: 0, events: null };

export default async function handler(req, res) {
  try {
    const url = String(req.query.url || "").trim();
    const days = Math.max(1, Math.min(365, Number(req.query.days || 60)));
    const max  = Math.max(1, Math.min(500, Number(req.query.max || 50)));
    if (!url) return res.status(400).json({ ok: false, error: "Mangler ?url=..." });

    const now = Date.now();
    if (CACHE.events && CACHE.url === url && CACHE.until > now) {
      return res.json({ ok: true, cached: true, events: limit(CACHE.events, days, max) });
    }

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Kunne ikke hente ICS (${r.status})`);
    const text = await r.text();
    const events = parseICS(text);
    CACHE = { url, until: now + 5*60*1000, events };

    return res.json({ ok: true, cached: false, events: limit(events, days, max) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

function limit(list, days, max){
  const now = new Date();
  const until = new Date(now.getTime() + days*86400000);
  return list.filter(e=>e.start >= now && e.start <= until).slice(0, max);
}

// PB-DESIGN: enkel ICS-parser til VEVENT
function parseICS(src){
  const lines = src.replace(/\r/g,"").split("\n");
  const flat = [];
  for (let i=0;i<lines.length;i++){
    let L = lines[i];
    while (i+1<lines.length && lines[i+1].startsWith(" ")) L += lines[++i].slice(1);
    flat.push(L);
  }
  const events=[]; let cur=null;
  for (const L of flat){
    if (L==="BEGIN:VEVENT") cur={};
    else if (L==="END:VEVENT") {
      if (cur?.DTSTART){
        const start = parseDate(cur.DTSTART, cur.DTSTARTTZID);
        const end   = parseDate(cur.DTEND||cur.DTSTART, cur.DTENDTZID);
        if (start) events.push({
          start, end,
          summary: cur.SUMMARY||"",
          location: cur.LOCATION||"",
          description: cur.DESCRIPTION||""
        });
      }
      cur=null;
    } else if (cur){
      const m = L.match(/^([A-Z\-]+)(;[^:]+)?:([\s\S]*)$/);
      if (!m) continue;
      const k = m[1], params = m[2]||"", v=(m[3]||"").trim();
      if (k==="DTSTART"){ cur.DTSTART=v; const tz=params.match(/TZID=([^;:]+)/); if (tz) cur.DTSTARTTZID=tz[1]; }
      else if (k==="DTEND"){ cur.DTEND=v; const tz=params.match(/TZID=([^;:]+)/); if (tz) cur.DTENDTZID=tz[1]; }
      else cur[k]=v;
    }
  }
  events.sort((a,b)=>a.start-b.start);
  return events;
}

function parseDate(v){
  if (!v) return null;
  if (/^\d{8}$/.test(v)){ // heldag
    const y=+v.slice(0,4), m=+v.slice(4,6)-1, d=+v.slice(6,8);
    return new Date(y,m,d);
  }
  if (/^\d{8}T\d{6}Z$/.test(v)){ // UTC
    const y=+v.slice(0,4), m=+v.slice(4,6)-1, d=+v.slice(6,8), H=+v.slice(9,11), M=+v.slice(11,13), S=+v.slice(13,15);
    return new Date(Date.UTC(y,m,d,H,M,S));
  }
  if (/^\d{8}T\d{6}$/.test(v)){ // lokal
    const y=+v.slice(0,4), m=+v.slice(4,6)-1, d=+v.slice(6,8), H=+v.slice(9,11), M=+v.slice(11,13), S=+v.slice(13,15);
    return new Date(y,m,d,H,M,S);
  }
  const dt = new Date(v);
  return isNaN(dt) ? null : dt;
}
