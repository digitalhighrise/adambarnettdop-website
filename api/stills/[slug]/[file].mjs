import { requireAuth, loadContent, deleteFile, SLUG_RE } from "../../_lib.mjs";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const { slug, file } = req.query;
  if (!SLUG_RE.test(String(slug)) || !/^\d{3}\.jpg$/.test(String(file))) {
    return res.status(400).json({ error: "bad path" });
  }
  if (req.method !== "DELETE") return res.status(405).json({ error: "method not allowed" });
  try {
    await deleteFile(`assets/stills/${slug}/${file}`, `admin: delete still ${slug}/${file}`);
    res.status(200).json({ ok: true, queued: true, ...(await loadContent()) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
