import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, contact, message, studioId } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: "Brak wymaganych pól" });

  const msgText = `📩 Wiadomość z /zapisy\n\nOd: ${name}${contact ? `\nKontakt: ${contact}` : ""}\n\nTreść:\n${message}`;

  // 1. Email via Gmail SMTP
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const contactEmail = process.env.CONTACT_EMAIL || gmailUser;

  if (gmailUser && gmailPass && contactEmail) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: `"Pilates Studio /zapisy" <${gmailUser}>`,
        to: contactEmail,
        subject: `Nowa wiadomość od ${name}`,
        text: msgText,
        html: `<div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#5C7A56">Nowa wiadomość z formularza</h2>
          <p><strong>Od:</strong> ${escapeHtml(name)}</p>
          ${contact ? `<p><strong>Kontakt:</strong> ${escapeHtml(contact)}</p>` : ""}
          <hr style="border:1px solid #E8E0D8;margin:1rem 0"/>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        </div>`,
      });
    } catch (err) {
      console.error("contact email error:", err.message);
    }
  }

  // 2. Powiadomienie w aplikacji (in-app)
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let adminsQuery = supabase.from("profiles").select("id").eq("role", "admin");
  if (studioId) adminsQuery = adminsQuery.eq("studio_id", studioId);
  const { data: admins } = await adminsQuery;

  if (admins?.length) {
    await supabase.from("notifications").insert(
      admins.map(a => ({
        user_id: a.id,
        type: "contact",
        class_id: null,
        message: `📩 Wiadomość z /zapisy od ${name}${contact ? ` (${contact})` : ""}: ${message}`,
        read: false,
        studio_id: studioId || null,
      }))
    );
  }

  res.status(200).json({ ok: true });
}
