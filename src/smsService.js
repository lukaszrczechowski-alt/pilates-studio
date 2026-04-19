export async function sendSms(to, message, token) {
  if (!to?.trim()) return;
  if (window.__isDemo) return;
  try {
    const res = await fetch("/api/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to, message }),
    });
    const data = await res.json();
    if (!res.ok) console.error("SMS failed:", data);
  } catch (e) {
    console.error("SMS error:", e);
  }
}

export function smsDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "2-digit", timeZone: "Europe/Warsaw" });
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  return `${day} o ${time}`;
}
