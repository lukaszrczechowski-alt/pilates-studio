import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getMaxClients(studioId) {
  const { data: studio } = await supabase.from("studios").select("plan_id, features").eq("id", studioId).maybeSingle();
  const studioMax = studio?.features?.max_clients;
  if (studioMax) return Number(studioMax);
  if (studio?.plan_id) {
    const { data: plan } = await supabase.from("plans").select("features").eq("id", studio.plan_id).maybeSingle();
    const planMax = plan?.features?.max_clients;
    if (planMax) return Number(planMax);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { classId, studioId, firstName, lastName, email, phone } = req.body || {};
  if (!classId || !studioId || !firstName || !email || !phone) {
    return res.status(400).json({ error: "Wypełnij wszystkie wymagane pola." });
  }

  // 1. Sprawdź zajęcia i miejsca
  const { data: cls } = await supabase
    .from("classes")
    .select("*, bookings(id)")
    .eq("id", classId)
    .eq("studio_id", studioId)
    .maybeSingle();

  if (!cls) return res.status(404).json({ error: "Nie znaleziono zajęć." });
  if (cls.cancelled) return res.status(400).json({ error: "Zajęcia zostały odwołane." });
  if ((cls.bookings?.length || 0) >= cls.max_spots) {
    return res.status(400).json({ error: "Brak wolnych miejsc." });
  }

  // 2. Sprawdź limit klientów studia
  const maxClients = await getMaxClients(studioId);
  if (maxClients !== null) {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("role", "client");
    if (count >= maxClients) return res.status(400).json({ error: "Studio osiągnęło limit klientów." });
  }

  // 3. Znajdź lub utwórz użytkownika
  let userId;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("studio_id", studioId)
    .maybeSingle();

  if (existingProfile) {
    userId = existingProfile.id;
  } else {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName || "" },
    });
    if (authErr) return res.status(500).json({ error: "Błąd tworzenia konta: " + authErr.message });
    userId = authData.user.id;

    await supabase.from("profiles").insert({
      id: userId,
      first_name: firstName,
      last_name: lastName || "",
      email: email.toLowerCase(),
      phone,
      role: "client",
      studio_id: studioId,
      account_type: "guest",
    });
  }

  // 3. Sprawdź duplikat rezerwacji
  const { data: dup } = await supabase
    .from("bookings")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .maybeSingle();

  if (dup) return res.status(400).json({ error: "Masz już rezerwację na te zajęcia." });

  // 4. Utwórz rezerwację
  const { error: bookErr } = await supabase.from("bookings").insert({
    class_id: classId,
    user_id: userId,
    studio_id: studioId,
    payment_method: "cash",
    payment_status: "free",
  });
  if (bookErr) return res.status(500).json({ error: "Błąd rezerwacji: " + bookErr.message });

  // 5. Magic link
  let magicLink = null;
  try {
    const appUrl = process.env.VITE_APP_URL || "https://studiova.app";
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: { redirectTo: `${appUrl}/app` },
    });
    magicLink = linkData?.properties?.action_link || null;
  } catch (e) {
    console.error("Magic link error:", e.message);
  }

  // 6. Email potwierdzający
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (gmailUser && gmailPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      const date = new Date(cls.starts_at).toLocaleDateString("pl-PL", {
        weekday: "long", day: "numeric", month: "long",
      });
      const time = new Date(cls.starts_at).toLocaleTimeString("pl-PL", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
      });

      const manageBtn = magicLink
        ? `<div style="text-align:center;margin:1.5rem 0;">
            <a href="${magicLink}" style="display:inline-block;background:#8A9E85;color:white;padding:.875rem 2rem;border-radius:8px;text-decoration:none;font-weight:500;font-family:Arial,sans-serif;">
              Zarządzaj rezerwacją →
            </a>
            <p style="font-size:.78rem;color:#ADADAD;margin-top:.6rem;">Link ważny 24h · pozwala odwołać lub sprawdzić szczegóły</p>
          </div>
          <div style="border-top:1px solid #E8E0D8;padding-top:1.25rem;text-align:center;font-size:.85rem;color:#6B6B6B;">
            Chcesz mieć historię wizyt i rezerwować szybciej?<br>
            <a href="${magicLink}" style="color:#8A9E85;font-weight:500;">Utwórz pełne konto →</a>
          </div>`
        : "";

      await transporter.sendMail({
        from: `"Rezerwacja" <${gmailUser}>`,
        to: email,
        subject: `✓ Rezerwacja: ${cls.name} — ${date}, ${time}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#2C2C2C;">
            <div style="background:#8A9E85;padding:2rem;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:white;font-size:1.4rem;margin:0;font-weight:400;">Rezerwacja potwierdzona</h1>
            </div>
            <div style="background:#F7F3EE;padding:2rem;border-radius:0 0 8px 8px;border:1px solid #E8E0D8;border-top:none;">
              <p>Cześć <strong>${firstName}</strong>,</p>
              <p style="color:#6B6B6B;">Twoja rezerwacja jest potwierdzona:</p>
              <div style="background:white;border:1px solid #E8E0D8;border-left:3px solid #8A9E85;border-radius:8px;padding:1.25rem;margin:1.25rem 0;">
                <div style="font-size:1.05rem;font-weight:600;margin-bottom:.5rem;">${cls.name}</div>
                <div style="color:#6B6B6B;margin:.2rem 0;">📅 ${date}</div>
                <div style="color:#6B6B6B;margin:.2rem 0;">🕐 ${time}${cls.duration_min ? ` · ${cls.duration_min} min` : ""}</div>
                ${cls.location ? `<div style="color:#6B6B6B;margin:.2rem 0;">📍 ${cls.location}</div>` : ""}
              </div>
              ${manageBtn}
            </div>
          </div>`,
      });
    }
  } catch (e) {
    console.error("Email send error:", e.message);
  }

  return res.status(200).json({ success: true });
}
