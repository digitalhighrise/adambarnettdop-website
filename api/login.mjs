import { checkPassword, makeToken, cookieFor } from "./_lib.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!checkPassword(body.password)) return res.status(401).json({ error: "wrong password" });
  res.setHeader("set-cookie", cookieFor(makeToken()));
  res.status(200).json({ ok: true });
}
