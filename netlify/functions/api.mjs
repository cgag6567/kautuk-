import { getStore } from "@netlify/blobs";
import BANK from "./bank.mjs";
import PHOTO from "./photo.mjs";

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
const shuf = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const okQ = (q) =>
  Array.isArray(q) && typeof q[1] === "string" && Array.isArray(q[2]) && q[2].length === 4 &&
  q[2].every((t) => typeof t === "string") && Number.isInteger(q[3]) && q[3] >= 0 && q[3] < 4;
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
  const players = async () => {
    const { blobs } = await s.list({ prefix: K("p/") });
    const ps = await Promise.all(
      blobs.map(async (x) => {
        const p = await get(x.key);
        return p ? { pid: x.key.split("/p/")[1], n: p.n, a: p.a } : null;
      })
    );
    return ps.filter(Boolean);
  };

  try {
    if (a === "cats") {
      const c = {};
      for (const q of BANK.concat(PHOTO)) c[q[0]] = (c[q[0]] || 0) + 1;
      return J({ cats: c });
    }

    if (a === "create") {
      const cat = String(b.cat || "");
      const n = Math.max(3, Math.min(40, Number(b.n) || 10));
      const L = Math.max(10, Math.min(60, Number(b.L) || 20));
      const extra = (Array.isArray(b.extra) ? b.extra : []).filter(okQ).slice(0, 600)
        .map((q) => [String(q[0] || "सामान्य").slice(0, 30), q[1].slice(0, 400), q[2].map((t) => t.slice(0, 120)), q[3], q[4] ? String(q[4]).slice(0, 1500) : ""]);
      const pool = BANK.concat(PHOTO, extra).filter((q) => !cat || q[0] === cat);
      if (!pool.length) return J({ e: "empty" }, 400);
      const qs = shuf(pool).slice(0, n).map((q) => {
        const o = shuf(q[2].map((t, i) => [t, i === q[3]]));
        return { c: q[0], q: q[1], o: o.map((x) => x[0]), k: o.findIndex((x) => x[1]), img: q[4] && String(q[4]).length < 1500 ? q[4] : "" };
      });
      for (let i = 0; i < 15; i++) {
        const p = String(1000 + Math.floor(Math.random() * 9000));
        const m = await get(`g${p}/meta`);
        if (!m || now - (m.created || 0) > TTL) {
          const key = rid(16);
          const old = await s.list({ prefix: `g${p}/` });
          await Promise.all(old.blobs.map((x) => s.delete(x.key)));
          await s.setJSON(`g${p}/host`, { k: key });
          await s.setJSON(`g${p}/secret`, { qs, L, sc: {}, nm: {}, board: [] });
          await s.setJSON(`g${p}/meta`, { ph: "lobby", v: 1, names: [], n: qs.length, created: now });
          return J({ pin: p, hk: key, now, total: qs.length, L });
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

    if (a === "join") {
      const m = await get(K("meta"));
      if (!m) return J({ e: "nogame" }, 404);
      const old = String(b.pid || "");
      if (/^[a-z0-9]{10}$/.test(old)) {
        const p = await get(K("p/" + old));
        if (p) return J({ pid: old, n: p.n, now });
      }
      if (m.ph !== "lobby") return J({ e: "started" }, 409);
      const ps = await players();
      if (ps.length >= MAXP) return J({ e: "full" }, 409);
      const names = new Set(ps.map((p) => p.n));
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

    // ---- नीचे की सभी क्रियाएँ केवल होस्ट (गेम बनाने वाले) के लिए ----
    if (!(await isHost())) return J({ e: "auth" }, 403);

    if (a === "players") {
      const ps = await players();
      const m = await get(K("meta"));
      if (m && m.ph === "lobby") {
        const nm = ps.map((p) => p.n).sort();
        if (nm.join("|") !== (m.names || []).join("|")) {
          m.names = nm; m.v = (m.v || 0) + 1;
          await s.setJSON(K("meta"), m);
        }
      }
      return J({ now, ps });
    }

    if (a === "next") {
      const m = (await get(K("meta"))) || {};
      const sec = await get(K("secret"));
      if (!sec) return J({ e: "nogame" }, 404);
      if (m.ph === "q" || m.ph === "lock") return J({ e: "state" }, 409);
      if (m.ph === "end") return J({ ok: 1, now, meta: m });
      const i = m.ph === "rev" ? m.i + 1 : 0;
      let nm;
      if (i >= sec.qs.length) {
        nm = { ph: "end", b: sec.board, v: (m.v || 0) + 1, created: m.created };
      } else {
        const q = sec.qs[i];
        nm = { ph: "q", i, n: sec.qs.length, L: sec.L, c: q.c, q: q.q, o: q.o, img: q.img, t0: now, v: (m.v || 0) + 1, created: m.created };
      }
      await s.setJSON(K("meta"), nm);
      return J({ ok: 1, now, meta: nm });
    }

    if (a === "reveal") {
      const m = await get(K("meta"));
      if (!m) return J({ e: "nogame" }, 404);
      if (m.ph === "rev") return J({ ok: 1, now, meta: m });
      if (m.ph !== "q") return J({ e: "state" }, 409);
      await s.setJSON(K("meta"), { ...m, ph: "lock", v: m.v + 1 }); // देर से आए उत्तर अब नहीं लिए जाएँगे
      const sec = await get(K("secret"));
      const q = sec.qs[m.i], L = sec.L * 1000;
      const ps = await players();
      for (const p of ps) {
        const x = p.a[m.i];
        const d = x && x.c === q.k ? Math.round(1000 * (1 - Math.min(x.t, L) / (2 * L))) : 0;
        sec.sc[p.pid] = (sec.sc[p.pid] || 0) + d;
        sec.nm[p.pid] = p.n;
        p.d = d; p.c = x ? x.c : null;
      }
      const board = ps.map((p) => ({ p: p.pid, n: p.n, s: sec.sc[p.pid], d: p.d, c: p.c })).sort((x, y) => y.s - x.s);
      sec.board = board.map((x) => ({ p: x.p, n: x.n, s: x.s, d: 0, c: null }));
      await s.setJSON(K("secret"), sec);
      const nm = { ph: "rev", i: m.i, n: m.n, q: q.q, o: q.o, k: q.k, b: board, v: m.v + 2, created: m.created };
      await s.setJSON(K("meta"), nm);
      return J({ ok: 1, now, meta: nm });
    }

    if (a === "close") {
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
