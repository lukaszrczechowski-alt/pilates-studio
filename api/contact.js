import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, contact, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: "Brak wymaganych pól" });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  if (admins?.length) {
    await supabase.from("notifications").insert(
      admins.map(a => ({
        user_id: a.id,
        type: "contact",
        message: `📩 Wiadomość z /zapisy od ${name}${contact ? ` (${contact})` : ""}: ${message}`,
      }))
    );
  }

  res.status(200).json({ ok: true });
}
