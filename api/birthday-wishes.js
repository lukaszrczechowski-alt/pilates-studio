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
    body: new URLSearchParams({ to: normPhone(to), message, format: "json", encoding: "utf-8" }).toString(),
  });
  return response.json();
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Dziś w Warszawie — format "YYYY-MM-DD" (sv-SE zawsze zwraca ISO)
  const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  const [, mm, dd] = todayISO.split("-");
  const todayMMDD = `${mm}-${dd}`;

  // Pobierz klientów z urodzinami dzisiaj
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, first_name, email, phone, birth_date, studios(name, branding)")
    .eq("role", "client")
    .not("birth_date", "is", null);

  if (error) return res.status(500).json({ error: error.message });

  const birthdays = (profiles || []).filter(p => {
    if (!p.birth_date) return false;
    const parts = p.birth_date.split("-");
    return `${parts[1]}-${parts[2]}` === todayMMDD;
  });

  let sent = 0, skipped = 0, errors = 0;

  for (const p of birthdays) {
    if (p.studios?.features?.is_demo) { skipped++; continue; }
    const sig = p.studios?.branding?.sms_signature || p.studios?.name || "Studio";
    await supabase.from("notifications").insert({
      type: "birthday",
      user_id: p.id,
      message: `Wszystkiego najlepszego, ${p.first_name}! Zycze Ci duzo zdrowia i energii do cwiczen! ${sig}`,
    });

    if (p.phone) {
      const message = `Wszystkiego najlepszego, ${p.first_name}! Zycze Ci duzo zdrowia i energii do cwiczen! - ${sig}`;
      try {
        const result = await sendSmsApi(p.phone, message);
        if (result.error) { console.error("Birthday SMS error:", result); errors++; }
        else sent++;
      } catch (e) {
        console.error("Birthday SMS exception:", e); errors++;
      }
    } else {
      skipped++;
    }
  }

  return res.status(200).json({ total: birthdays.length, sent, skipped, errors });
}
