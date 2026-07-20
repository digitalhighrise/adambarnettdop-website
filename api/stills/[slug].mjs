import { requireAuth, loadContent, putFile, getJson, SLUG_RE } from "../_lib.mjs";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const { slug } = req.query;
  if (!SLUG_RE.test(String(slug))) return res.status(400).json({ error: "bad slug" });
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const listing = await getJson(`/contents/assets/stills/${slug}?ref=main`);
    let n = (Array.isArray(listing) ? listing : [])
      .reduce((m, f) => Math.max(m, parseInt(f.name, 10) || 0), 0);
    for (const f of body.files || []) {
      n += 1;
      const name = `${String(n).padStart(3, "0")}.jpg`;
      await putFile(`assets/stills/${slug}/${name}`, f.data, `admin: add still ${slug}/${name}`);
    }
    res.status(200).json({ ok: true, queued: true, ...(await loadContent()) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
