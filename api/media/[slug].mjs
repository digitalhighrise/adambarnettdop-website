import { requireAuth, loadContent, putFile, SLUG_RE } from "../_lib.mjs";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const { slug } = req.query;
  if (!SLUG_RE.test(String(slug))) return res.status(400).json({ error: "bad slug" });
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (!["loop", "poster"].includes(body.kind)) return res.status(400).json({ error: "bad kind" });
    const path = body.kind === "loop" ? `assets/loops/${slug}.mp4` : `assets/posters/${slug}.jpg`;
    await putFile(path, body.data, `admin: upload ${body.kind} for ${slug}`);
    res.status(200).json({ ok: true, queued: true, ...(await loadContent()) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
