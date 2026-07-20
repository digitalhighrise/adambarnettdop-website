// Admin server: serves the static site + /admin UI + /api endpoints that
// edit tools/projects.json and assets, rebuilding the site after each change.
// Run: node tools/admin-server.mjs   (default http://localhost:4321)
//
// Auth: password in ADMIN_PASSWORD env or tools/.admin-password (auto-generated
// on first run, gitignored). Sessions are HMAC cookies signed with a per-boot key.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname, extname, normalize, sep, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.ADMIN_PORT || 4321);
const DATA = join(root, "tools", "projects.json");
const PASS_FILE = join(root, "tools", ".admin-password");

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  if (!existsSync(PASS_FILE)) writeFileSync(PASS_FILE, randomBytes(9).toString("base64url"));
  password = readFileSync(PASS_FILE, "utf8").trim();
}

const sessionKey = randomBytes(32);
const sign = (v) => createHmac("sha256", sessionKey).update(v).digest("base64url");
const makeToken = () => { const id = randomBytes(16).toString("base64url"); return `${id}.${sign(id)}`; };
const validToken = (t) => {
  if (!t) return false;
  const [id, sig] = t.split(".");
  if (!id || !sig) return false;
  const good = Buffer.from(sign(id));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got);
};

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const STILL_RE = /^\d{3}\.jpg$/;

const stillsOf = (slug) => {
  const dir = join(root, "assets", "stills", slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
};

const rebuild = () => execFileSync(process.execPath, [join(root, "tools", "build.mjs")], { encoding: "utf8" });

const allSlugs = (data) => {
  const projs = data.projects.concat((data.moreWork || []).flatMap((s) => s.items || []));
  const slugs = projs.map((p) => p.slug);
  projs.forEach((p) => { if (p.bts) slugs.push(p.bts); });
  return [...new Set(slugs)];
};

const contentPayload = () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const media = {};
  for (const slug of allSlugs(data)) {
    media[slug] = {
      stills: stillsOf(slug),
      hasLoop: existsSync(join(root, "assets", "loops", `${slug}.mp4`)),
      hasPoster: existsSync(join(root, "assets", "posters", `${slug}.jpg`)),
    };
  }
  return { data, media };
};

const validateData = (d) => {
  if (!d || typeof d !== "object") return "bad payload";
  if (!Array.isArray(d.projects) || !Array.isArray(d.moreWork)) return "projects/moreWork missing";
  for (const p of d.projects.concat(d.moreWork.flatMap((s) => s.items || []))) {
    if (!p.slug || !SLUG_RE.test(p.slug)) return `bad slug: ${p.slug || "(empty)"}`;
    if (p.bts && !SLUG_RE.test(p.bts)) return `bad bts folder name: ${p.bts}`;
    if (!p.title) return `project ${p.slug} has no title`;
  }
  for (const k of ["name", "role", "email", "bio"]) if (typeof d[k] !== "string") return `${k} missing`;
  return null;
};

const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

const readBody = (req, limit = 120 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    /* ---------------- api ---------------- */
    if (path.startsWith("/api/")) {
      if (path === "/api/login" && req.method === "POST") {
        const body = JSON.parse((await readBody(req, 4096)).toString() || "{}");
        const got = Buffer.from(String(body.password || ""));
        const want = Buffer.from(password);
        if (got.length !== want.length || !timingSafeEqual(got, want)) {
          return json(res, 401, { error: "wrong password" });
        }
        res.writeHead(200, {
          "content-type": "application/json",
          "set-cookie": `abadmin=${makeToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`,
        });
        return res.end('{"ok":true}');
      }

      const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("abadmin="));
      if (!validToken(cookie && cookie.slice(8))) return json(res, 401, { error: "not logged in" });

      if (path === "/api/logout" && req.method === "POST") {
        res.writeHead(200, { "content-type": "application/json", "set-cookie": "abadmin=; Path=/; Max-Age=0" });
        return res.end('{"ok":true}');
      }

      if (path === "/api/content" && req.method === "GET") return json(res, 200, contentPayload());

      if (path === "/api/content" && req.method === "PUT") {
        const body = JSON.parse((await readBody(req)).toString());
        const err = validateData(body.data);
        if (err) return json(res, 400, { error: err });
        writeFileSync(DATA, JSON.stringify(body.data, null, 2) + "\n");
        const out = rebuild();
        return json(res, 200, { ok: true, build: out.trim(), ...contentPayload() });
      }

      // POST /api/stills/<slug>  body: {files:[{data:base64jpeg}]}
      const stillsPost = path.match(/^\/api\/stills\/([a-z0-9-]+)$/);
      if (stillsPost && req.method === "POST") {
        const slug = stillsPost[1];
        if (!SLUG_RE.test(slug)) return json(res, 400, { error: "bad slug" });
        const body = JSON.parse((await readBody(req)).toString());
        const dir = join(root, "assets", "stills", slug);
        mkdirSync(dir, { recursive: true });
        let n = stillsOf(slug).reduce((m, f) => Math.max(m, parseInt(f, 10)), 0);
        for (const f of body.files || []) {
          n += 1;
          writeFileSync(join(dir, `${String(n).padStart(3, "0")}.jpg`), Buffer.from(f.data, "base64"));
        }
        rebuild();
        return json(res, 200, { ok: true, ...contentPayload() });
      }

      // DELETE /api/stills/<slug>/<NNN.jpg>
      const stillsDel = path.match(/^\/api\/stills\/([a-z0-9-]+)\/(\d{3}\.jpg)$/);
      if (stillsDel && req.method === "DELETE") {
        const [, slug, file] = stillsDel;
        if (!SLUG_RE.test(slug) || !STILL_RE.test(file)) return json(res, 400, { error: "bad path" });
        const target = join(root, "assets", "stills", slug, file);
        if (existsSync(target)) unlinkSync(target);
        rebuild();
        return json(res, 200, { ok: true, ...contentPayload() });
      }

      // POST /api/media/<slug>  body: {kind:"loop"|"poster", data:base64}
      const mediaPost = path.match(/^\/api\/media\/([a-z0-9-]+)$/);
      if (mediaPost && req.method === "POST") {
        const slug = mediaPost[1];
        const body = JSON.parse((await readBody(req)).toString());
        if (!SLUG_RE.test(slug) || !["loop", "poster"].includes(body.kind)) return json(res, 400, { error: "bad request" });
        const dest = body.kind === "loop"
          ? join(root, "assets", "loops", `${slug}.mp4`)
          : join(root, "assets", "posters", `${slug}.jpg`);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, Buffer.from(body.data, "base64"));
        rebuild();
        return json(res, 200, { ok: true, ...contentPayload() });
      }

      return json(res, 404, { error: "no such endpoint" });
    }

    /* ---------------- static ---------------- */
    let file = path === "/" ? "/index.html" : path;
    if (file === "/admin" || file === "/admin/") file = "/admin/index.html";
    const safe = normalize(join(root, decodeURIComponent(file)));
    const rel = relative(root, safe);
    // stay inside the repo, and never serve tools/ (password file, scripts),
    // node_modules or dotfiles (.git etc)
    const parts = rel.split(sep);
    if (rel.startsWith("..") || !rel || parts[0] === "tools" || parts[0] === "node_modules" || parts.some((p) => p.startsWith("."))) {
      res.writeHead(403); return res.end();
    }
    let target = safe;
    if (!existsSync(target) && existsSync(`${target}.html`)) target = `${target}.html`;
    if (!existsSync(target)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[extname(target)] || "application/octet-stream" });
    return res.end(readFileSync(target));
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
});

// loopback only while this runs locally; bind 0.0.0.0 deliberately if ever hosted
server.listen(PORT, process.env.ADMIN_HOST || "127.0.0.1", () => {
  console.log(`site    http://localhost:${PORT}/`);
  console.log(`admin   http://localhost:${PORT}/admin`);
  console.log(`login   ${password}`);
});
