import { getStore } from "@netlify/blobs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const rid = (n) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => (x % 36).toString(36)).join("");
};
const clean = (s) => String(s || "").replace(/[<>&"'`]/g, "").trim().slice(0, 14);
const MAXP = 40;               // अधिकतम खिलाड़ी प्रति गेम
const TTL = 8 * 3600 * 1000;   // पुराने गेम (8 घंटे) दोबारा उपयोग हो सकते हैं

export default async (req) => {
  const s = getStore({ name: "quiz", consistency: "strong" });
  const u = new URL(req.url);
  let b = {};
  if (req.method === "POST") {
    try { b = await req.json(); } catch { return J({ e: "bad" }, 400); }
  }
  const a = u.searchParams.get("a") || b.a;
  const pin = String(u.searchParams.get("pin") || b.pin || "").replace(/\D/g, "").slice(0, 4);
  const hk = String(u.searchParams.get("hk") || b.hk || "");
  const now = Date.now();
  const K = (x) => `g${pin}/${x}`;
  const get = (k) => s.get(k, { type: "json" });
  const isHost = async () => {
    if (!hk || pin.length !== 4) return false;
    const h = await get(K("host"));
    return !!h && h.k === hk;
  };

  try {
    if (a === "create") {
      const need = process.env.HOST_PASSWORD; // Netlify में सेट करें; खाली हो तो कोई भी गेम बना सकता है
      if (need && String(b.pw || "") !== need) return J({ e: "pw" }, 403);
      for (let i = 0; i < 15; i++) {
        const p = String(1000 + Math.floor(Math.random() * 9000));
        const m = await get(`g${p}/meta`);
        if (!m || now - (m.created || 0) > TTL) {
          const key = rid(16);
          const old = await s.list({ prefix: `g${p}/` });
          await Promise.all(old.blobs.map((x) => s.delete(x.key)));
          await s.setJSON(`g${p}/host`, { k: key });
          await s.setJSON(`g${p}/meta`, { ph: "lobby", v: 1, names: [], created: now });
          return J({ pin: p, hk: key, now });
        }
      }
      return J({ e: "busy" }, 503);
    }

    if (pin.length !== 4) return J({ e: "pin" }, 400);

    if (a === "state") {
      const m = await get(K("meta"));
      if (!m) return J({ e: "nogame" }, 404);
      const v = u.searchParams.get("v");
      if (v !== null && Number(v) === m.v) return J({ now, same: 1 });
      return J({ now, meta: m });
    }

    if (a === "set") {
      if (!(await isHost())) return J({ e: "auth" }, 403);
      const old = (await get(K("meta"))) || {};
      const m = b.meta || {};
      if (JSON.stringify(m).length > 30000) return J({ e: "big" }, 413);
      m.v = (old.v || 0) + 1;
      m.created = old.created || now;
      if (m.ph === "q") m.t0 = now;
      await s.setJSON(K("meta"), m);
      return J({ ok: 1, now, meta: m });
    }

    if (a === "join") {
      const m = await get(K("meta"));
      if (!m) return J({ e: "nogame" }, 404);
      const old = String(b.pid || "");
      if (/^[a-z0-9]{10}$/.test(old)) {
        const p = await get(K("p/" + old));
        if (p) return J({ pid: old, n: p.n, now });
      }
      if (m.ph !== "lobby") return J({ e: "started" }, 409);
      const { blobs } = await s.list({ prefix: K("p/") });
      if (blobs.length >= MAXP) return J({ e: "full" }, 409);
      const all = await Promise.all(blobs.map((x) => get(x.key)));
      const names = new Set(all.filter(Boolean).map((p) => p.n));
      let n = clean(b.n) || "खिलाड़ी";
      let nn = n, c = 2;
      while (names.has(nn)) nn = `${n} ${c++}`;
      const pid = rid(10);
      await s.setJSON(K("p/" + pid), { n: nn, a: {} });
      return J({ pid, n: nn, now });
    }

    if (a === "answer") {
      const m = await get(K("meta"));
      const qi = Number(b.qi), c = Number(b.c);
      if (!m || m.ph !== "q" || m.i !== qi) return J({ e: "closed" }, 409);
      const t = now - m.t0;
      if (t > m.L * 1000 + 1500) return J({ e: "closed" }, 409);
      if (!(c >= 0 && c <= 3)) return J({ e: "bad" }, 400);
      const pid = String(b.pid || "");
      if (!/^[a-z0-9]{10}$/.test(pid)) return J({ e: "bad" }, 400);
      const p = await get(K("p/" + pid));
      if (!p) return J({ e: "nop" }, 404);
      if (p.a[qi] != null) return J({ ok: 1, dup: 1 });
      p.a[qi] = { c, t };
      await s.setJSON(K("p/" + pid), p);
      return J({ ok: 1 });
    }

    if (a === "players") {
      if (!(await isHost())) return J({ e: "auth" }, 403);
      const { blobs } = await s.list({ prefix: K("p/") });
      const ps = await Promise.all(
        blobs.map(async (x) => {
          const p = await get(x.key);
          return p ? { pid: x.key.split("/p/")[1], n: p.n, a: p.a } : null;
        })
      );
      return J({ now, ps: ps.filter(Boolean) });
    }

    if (a === "close") {
      if (!(await isHost())) return J({ e: "auth" }, 403);
      const { blobs } = await s.list({ prefix: K("") });
      await Promise.all(blobs.map((x) => s.delete(x.key)));
      return J({ ok: 1 });
    }

    return J({ e: "unknown" }, 400);
  } catch (err) {
    return J({ e: "srv", m: String(err && err.message || err) }, 500);
  }
};

export const config = { path: "/api" };
