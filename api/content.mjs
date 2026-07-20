import { requireAuth, loadContent, validateData, putFile } from "./_lib.mjs";

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === "GET") return res.status(200).json(await loadContent());

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const err = validateData(body.data);
      if (err) return res.status(400).json({ error: err });
      const json = JSON.stringify(body.data, null, 2) + "\n";
      await putFile("tools/projects.json", Buffer.from(json).toString("base64"), "admin: update site content");
      return res.status(200).json({ ok: true, queued: true, data: body.data, media: (await loadContent()).media });
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
