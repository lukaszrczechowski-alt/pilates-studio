/**
 * Wysyła SMS przez nasz endpoint /api/send-sms
 * Jeśli `to` jest puste — pomija cicho (użytkownik bez telefonu)
 */
export async function sendSms(to, message) {
  if (!to?.trim()) return;
  try {
    const res = await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message }),
    });
    const data = await res.json();
    if (!res.ok) console.error("SMS failed:", data);
    else console.log("SMS sent to", to);
  } catch (e) {
    console.error("SMS error:", e);
  }
}

/** Formatuje datę do SMS (np. "środa 23.04 o 18:00") */
export function smsDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "2-digit", timeZone: "Europe/Warsaw" });
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  return `${day} o ${time}`;
}
