// move-stats: stores Move's anonymous analytics in Firestore (free tier). Runs on
// Google Cloud Run; only Move's own server (Vercel) talks to it, with the shared secret.
//
//   move_days/{YYYY-MM-DD}                counts for the day (events, countries, devices, referrers)
//   move_days/{YYYY-MM-DD}/visitors/{id}  one doc per daily visitor hash (counted, never read back)
//   move_logins/{ip hash}                 admin sign-in attempts (rate limit)
// The collections are prefixed so this can share a Firestore database with other apps.
import http from "node:http";
import { Firestore, FieldValue } from "@google-cloud/firestore";

const db = new Firestore({ ignoreUndefinedProperties: true });
const SECRET = process.env.STATS_SECRET ?? "";
const inc = (n = 1) => FieldValue.increment(n);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s, n) => String(s ?? "").slice(0, n);
/** Firestore deletes records once this date passes (a TTL policy on "expires"): ~13 months. */
const expires = () => new Date(Date.now() + 400 * 864e5);

async function event({ day, name, visitor }) {
  if (!DAY.test(day) || !/^[a-z_]{1,20}$/.test(name)) return;
  const doc = { [name]: inc() };
  if (visitor) {
    const { id, country, device, ref } = visitor;
    if (/^[0-9a-f]{8,64}$/.test(id ?? "")) await db.doc(`move_days/${day}/visitors/${id}`).set({ expires: expires() });
    doc.countries = { [clean(country, 2) || "??"]: inc() };
    doc.devices = { [clean(device, 10) || "unknown"]: inc() };
    if (ref) doc.referrers = { [clean(ref, 60)]: inc() };
  }
  await db.doc(`move_days/${day}`).set({ ...doc, expires: expires() }, { merge: true });
}

async function stats(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const snaps = await db.getAll(...dates.map((d) => db.doc(`move_days/${d}`)));
  const uniques = await Promise.all(dates.map((d) => db.collection(`move_days/${d}/visitors`).count().get().then((s) => s.data().count)));
  const countries = {};
  const devices = {};
  const referrers = {};
  const add = (into, from) => {
    for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v;
  };
  const daily = dates.map((day, i) => {
    const { countries: c, devices: d, referrers: r, expires: _e, ...counts } = snaps[i].data() ?? {};
    add(countries, c);
    add(devices, d);
    add(referrers, r);
    return { day, visitors: uniques[i], ...counts };
  });
  const totals = {};
  for (const { day: _day, visitors: _visitors, ...c } of daily) add(totals, c);
  return { days, daily, visitors: uniques.reduce((a, b) => a + b, 0), totals, countries, devices, referrers };
}

/** At most 8 admin sign-in attempts per 15 minutes from one place. */
async function loginAllowed({ who }) {
  if (!/^[0-9a-f]{8,64}$/.test(who ?? "")) return false;
  const ref = db.doc(`move_logins/${who}`);
  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const cur = (await tx.get(ref)).data();
    const fresh = !cur || now - cur.since > 15 * 60 * 1000;
    const count = fresh ? 1 : cur.count + 1;
    tx.set(ref, { since: fresh ? now : cur.since, count, expires: new Date(now + 864e5) });
    return count <= 8;
  });
}

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/") return send(res, 200, { ok: true });
      if (!SECRET || req.headers["x-move-key"] !== SECRET) return send(res, 403, { error: "Not allowed." });
      let body = {};
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 10_000) return send(res, 413, { error: "Too big." });
        }
        body = JSON.parse(raw || "{}");
      }
      if (req.method === "POST" && url.pathname === "/event") return (await event(body), send(res, 204));
      if (req.method === "POST" && url.pathname === "/login") return send(res, 200, { allowed: await loginAllowed(body) });
      if (req.method === "GET" && url.pathname === "/stats") return send(res, 200, await stats(Math.min(90, Math.max(7, Number(url.searchParams.get("days")) || 30))));
      send(res, 404, { error: "Not found." });
    } catch (error) {
      console.error(error);
      send(res, 500, { error: "Something went wrong." });
    }
  })
  .listen(Number(process.env.PORT) || 8080, () => console.log("move-stats ready"));
