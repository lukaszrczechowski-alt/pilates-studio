import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function isAdmin(token) {
  if (!token) return false;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ["admin", "superadmin"].includes(p?.role);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!await isAdmin(token)) return res.status(403).json({ error: "Forbidden" });

  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: "Missing to or message" });

  const safeMessage = message
    .replace(/—|–/g, "-")
    .replace(/„|"|"/g, '"')
    .replace(/'|'/g, "'")
    .replace(/…/g, "...");

  const smsToken = process.env.SMSAPI_TOKEN;
  if (!smsToken) return res.status(500).json({ error: "SMSAPI_TOKEN not configured" });

  let phone = to.replace(/[\s\-\(\)]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "48" + phone.slice(1);
  if (!phone.startsWith("48") && phone.length === 9) phone = "48" + phone;

  try {
    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: { Authorization: `Bearer ${smsToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ to: phone, message: safeMessage, from: "PILATES", format: "json", encoding: "utf-8" }).toString(),
    });
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.message, code: data.error });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
