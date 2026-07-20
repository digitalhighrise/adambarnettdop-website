// Shared helpers for the /api Vercel functions. Content lives in the GitHub
// repo (source of truth); every write is a commit, which triggers a redeploy.
// Env: ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN, GH_REPO (owner/name).
import { createHmac, timingSafeEqual } from "node:crypto";

const REPO = process.env.GH_REPO || "digitalhighrise/adambarnettdop-website";
const API = `https://api.github.com/repos/${REPO}`;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/* ---------------- github ---------------- */
export const gh = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "adambarnett-site-admin",
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!res.ok && res.status !== 404) throw new Error(`github ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
};

export const getJson = async (path) => {
  const r = await gh(path);
  return r.status === 404 ? null : r.json();
};

export const putFile = async (path, base64, message) => {
  const existing = await getJson(`/contents/${path}?ref=main`);
  await gh(`/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64, branch: "main", ...(existing?.sha ? { sha: existing.sha } : {}) }),
  });
};

export const deleteFile = async (path, message) => {
  const existing = await getJson(`/contents/${path}?ref=main`);
  if (!existing?.sha) return;
  await gh(`/contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha: existing.sha, branch: "main" }),
  });
};

/* ---------------- content payload ---------------- */
export const loadContent = async () => {
  const pj = await getJson("/contents/tools/projects.json?ref=main");
  if (!pj) throw new Error("projects.json not found in repo");
  const data = JSON.parse(Buffer.from(pj.content, "base64").toString("utf8"));

  const tree = await getJson("/git/trees/main?recursive=1");
  const paths = new Set((tree?.tree || []).map((t) => t.path));
  const stillsBySlug = {};
  for (const p of paths) {
    const m = p.match(/^assets\/stills\/([a-z0-9-]+)\/([^/]+\.jpg)$/);
    if (m) (stillsBySlug[m[1]] = stillsBySlug[m[1]] || []).push(m[2]);
  }

  const projs = data.projects.concat((data.moreWork || []).flatMap((s) => s.items || []));
  const slugs = new Set(projs.map((p) => p.slug));
  projs.forEach((p) => { if (p.bts) slugs.add(p.bts); });

  const media = {};
  for (const slug of slugs) {
    media[slug] = {
      stills: (stillsBySlug[slug] || []).sort(),
      hasLoop: paths.has(`assets/loops/${slug}.mp4`),
      hasPoster: paths.has(`assets/posters/${slug}.jpg`),
    };
  }
  return { data, media };
};

export const validateData = (d) => {
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

/* ---------------- auth ---------------- */
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (v) => createHmac("sha256", secret()).update(v).digest("base64url");

export const makeToken = () => {
  const exp = String(Date.now() + 7 * 24 * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
};

export const checkPassword = (got) => {
  const want = Buffer.from(String(process.env.ADMIN_PASSWORD || ""));
  const buf = Buffer.from(String(got || ""));
  return want.length > 0 && buf.length === want.length && timingSafeEqual(buf, want);
};

export const requireAuth = (req, res) => {
  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("abadmin="));
  const token = cookie && cookie.slice(8);
  const [exp, sig] = (token || "").split(".");
  const ok = exp && sig && Number(exp) > Date.now() &&
    Buffer.from(sig).length === Buffer.from(sign(exp)).length &&
    timingSafeEqual(Buffer.from(sig), Buffer.from(sign(exp)));
  if (!ok) res.status(401).json({ error: "not logged in" });
  return ok;
};

export const cookieFor = (token, maxAge = 604800) =>
  `abadmin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
