export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Missing to or message" });
  }

  // Zamień znaki spoza GSM-7 na bezpieczne odpowiedniki
  const safeMessage = message
    .replace(/—|–/g, "-")
    .replace(/„|"|"/g, '"')
    .replace(/'|'/g, "'")
    .replace(/…/g, "...");

  const token = process.env.SMSAPI_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "SMSAPI_TOKEN not configured" });
  }

  // Normalizacja numeru → format 48XXXXXXXXX
  let phone = to.replace(/[\s\-\(\)]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = "48" + phone.slice(1);
  if (!phone.startsWith("48") && phone.length === 9) phone = "48" + phone;

  try {
    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ to: phone, message: safeMessage, from: "PILATES", format: "json", encoding: "utf-8" }).toString(),
    });

    const data = await response.json();
    console.log("SMSAPI response:", JSON.stringify(data));
    if (data.error) {
      return res.status(400).json({ error: data.message, code: data.error });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("SMS fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}
