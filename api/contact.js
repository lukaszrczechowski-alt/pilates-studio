import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, contact, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: "Brak wymaganych pól" });

  const debug = {};
  const msgText = `📩 Wiadomość z /zapisy\n\nOd: ${name}${contact ? `\nKontakt: ${contact}` : ""}\n\nTreść:\n${message}`;

  // 1. Email via Gmail SMTP
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const contactEmail = process.env.CONTACT_EMAIL || gmailUser;
  debug.emailEnvSet = !!(gmailUser && gmailPass);

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
          <p><strong>Od:</strong> ${name}</p>
          ${contact ? `<p><strong>Kontakt:</strong> ${contact}</p>` : ""}
          <hr style="border:1px solid #E8E0D8;margin:1rem 0"/>
          <p style="white-space:pre-wrap">${message}</p>
        </div>`,
      });
      debug.emailSent = true;
    } catch (err) {
      debug.emailError = err.message;
    }
  }

  // 2. Powiadomienie w aplikacji (in-app)
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  debug.supabaseUrlSet = !!supabaseUrl;
  debug.supabaseKeySet = !!supabaseKey;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  debug.adminsFound = admins?.length ?? 0;
  if (adminsError) debug.adminsError = adminsError.message;

  if (admins?.length) {
    const { error: notifError } = await supabase.from("notifications").insert(
      admins.map(a => ({
        user_id: a.id,
        type: "contact",
        class_id: null,
        message: `📩 Wiadomość z /zapisy od ${name}${contact ? ` (${contact})` : ""}: ${message}`,
        read: false,
      }))
    );
    if (notifError) debug.notifError = notifError.message;
    else debug.notifInserted = admins.length;
  }

  res.status(200).json({ ok: true, debug });
}
