import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normPhone(to) {
  let phone = to.replace(/[\s\-\(\)]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "48" + phone.slice(1);
  if (!phone.startsWith("48") && phone.length === 9) phone = "48" + phone;
  return phone;
}

async function sendSmsApi(to, message) {
  const token = process.env.SMSAPI_TOKEN;
  const response = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ to: normPhone(to), message, from: "PILATES", format: "json", encoding: "utf-8" }).toString(),
  });
  return response.json();
}

export default async function handler(req, res) {
  // Weryfikacja tokenu Vercel Cron
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Zakres czasowy: jutro cały dzień (strefa Warsaw)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const start = new Date(tomorrow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setHours(23, 59, 59, 999);

  // Pobierz jutrzejsze zajęcia z rezerwacjami i numerami telefonów
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, starts_at, location, studio_id, studios(name, branding), bookings(user_id, profiles(first_name, phone))")
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .or("cancelled.is.null,cancelled.eq.false");

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ error: error.message });
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const cls of classes || []) {
    const time = new Date(cls.starts_at).toLocaleTimeString("pl-PL", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
    });
    const location = cls.location ? ` (${cls.location})` : "";
    if (cls.studios?.features?.is_demo) { skipped += (cls.bookings || []).length; continue; }
    const sig = cls.studios?.branding?.sms_signature || cls.studios?.name || "Studio";

    for (const booking of cls.bookings || []) {
      const phone = booking.profiles?.phone;
      if (!phone) { skipped++; continue; }

      const name = booking.profiles?.first_name || "Cześć";
      const message = `${name}, jutro o ${time} czekają na Ciebie zajęcia "${cls.name}"${location}. Do zobaczenia! — ${sig}`;

      try {
        const result = await sendSmsApi(phone, message);
        if (result.error) { console.error("SMS error:", result); errors++; }
        else sent++;
      } catch (e) {
        console.error("SMS exception:", e);
        errors++;
      }
    }
  }

  return res.status(200).json({
    classes: classes?.length || 0,
    sent, skipped, errors,
  });
}
