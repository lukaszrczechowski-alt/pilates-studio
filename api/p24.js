import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rozróżnienie: p24-notify od P24 zawiera orderId w body; p24-create zawiera classId + auth header
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { orderId } = req.body || {};

  if (orderId !== undefined) {
    return handleNotify(req, res);
  } else {
    return handleCreate(req, res);
  }
}

async function handleCreate(req, res) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { classId } = req.body;
  if (!classId) return res.status(400).json({ error: "Brak classId" });

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id, name, starts_at, price_pln, max_spots, studio_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError || !cls) return res.status(404).json({ error: "Nie znaleziono zajęć" });
  if (!cls.price_pln || cls.price_pln <= 0) return res.status(400).json({ error: "Zajęcia nie mają ustawionej ceny" });

  const { data: existing } = await supabase
    .from("bookings").select("id").eq("class_id", classId).eq("user_id", user.id).maybeSingle();
  if (existing) return res.status(409).json({ error: "Masz już rezerwację na te zajęcia" });

  const { count } = await supabase
    .from("bookings").select("id", { count: "exact", head: true }).eq("class_id", classId);
  if (count >= cls.max_spots) return res.status(409).json({ error: "Brak wolnych miejsc" });

  const { data: profile } = await supabase
    .from("profiles").select("email, first_name, last_name").eq("id", user.id).maybeSingle();

  const sessionId = `${user.id.replace(/-/g, "").slice(0, 8)}-${classId.replace(/-/g, "").slice(0, 8)}-${Date.now()}`;
  const amount = Math.round(cls.price_pln * 100);

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({ class_id: classId, user_id: user.id, payment_method: "online", payment_status: "pending", payment_session_id: sessionId, studio_id: cls.studio_id })
    .select().single();

  if (bookingError) return res.status(500).json({ error: bookingError.message });

  // Pobierz konfigurację P24 ze studia (fallback na env vars)
  const { data: studioRow } = await supabase.from("studios").select("payment_config, branding").eq("id", cls.studio_id).single();
  const p24cfg = studioRow?.payment_config?.p24;
  const merchantId = Number(p24cfg?.merchant_id || process.env.P24_MERCHANT_ID);
  const posId = Number(p24cfg?.pos_id || p24cfg?.merchant_id || process.env.P24_POS_ID || process.env.P24_MERCHANT_ID);
  const crcKey = p24cfg?.crc_key || process.env.P24_CRC_KEY;
  const apiKey = p24cfg?.api_key || process.env.P24_API_KEY;
  const sandbox = p24cfg ? p24cfg.sandbox !== false : process.env.P24_SANDBOX === "true";
  const baseUrl = sandbox ? "https://sandbox.przelewy24.pl" : "https://secure.przelewy24.pl";
  const appUrl = studioRow?.branding?.app_url || process.env.VITE_APP_URL;

  if (!merchantId || !crcKey || !apiKey) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    return res.status(500).json({ error: "Płatności online nie są skonfigurowane dla tego studia" });
  }

  const sign = crypto.createHash("sha384")
    .update(JSON.stringify({ sessionId, merchantId, amount, currency: "PLN", crc: crcKey }))
    .digest("hex");

  try {
    const response = await fetch(`${baseUrl}/api/v1/transaction/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${posId}:${apiKey}`).toString("base64"),
      },
      body: JSON.stringify({
        merchantId, posId, sessionId, amount, currency: "PLN",
        description: `Zajęcia: ${cls.name}`,
        email: profile?.email || user.email,
        country: "PL", language: "pl",
        urlReturn: `${appUrl}/?platnosc=ok&session=${sessionId}`,
        urlStatus: `${appUrl}/api/p24`,
        sign,
      }),
    });

    const p24Data = await response.json();
    if (!p24Data.data?.token) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return res.status(500).json({ error: "Błąd rejestracji płatności w P24" });
    }

    return res.status(200).json({ redirectUrl: `${baseUrl}/trnRequest/${p24Data.data.token}` });
  } catch (e) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    return res.status(500).json({ error: "Błąd połączenia z P24" });
  }
}

async function handleNotify(req, res) {
  const { merchantId, posId, sessionId, amount, currency, orderId, sign } = req.body;

  // Pobierz konfigurację studia przez session_id z bookingu
  const { data: booking } = await supabase.from("bookings").select("studio_id").eq("payment_session_id", sessionId).maybeSingle();
  let crcKey = process.env.P24_CRC_KEY;
  let apiKey = process.env.P24_API_KEY;
  let sandbox = process.env.P24_SANDBOX === "true";
  if (booking?.studio_id) {
    const { data: studioRow } = await supabase.from("studios").select("payment_config").eq("id", booking.studio_id).single();
    const p24cfg = studioRow?.payment_config?.p24;
    if (p24cfg?.crc_key) crcKey = p24cfg.crc_key;
    if (p24cfg?.api_key) apiKey = p24cfg.api_key;
    if (p24cfg?.sandbox !== undefined) sandbox = p24cfg.sandbox !== false;
  }
  const baseUrl = sandbox ? "https://sandbox.przelewy24.pl" : "https://secure.przelewy24.pl";

  const expectedSign = crypto.createHash("sha384")
    .update(JSON.stringify({ sessionId, orderId: Number(orderId), amount: Number(amount), currency, crc: crcKey }))
    .digest("hex");

  if (sign !== expectedSign) {
    console.error("P24 notify: nieprawidłowy podpis");
    return res.status(400).end();
  }

  const verifySign = crypto.createHash("sha384")
    .update(JSON.stringify({ sessionId, orderId: Number(orderId), amount: Number(amount), currency, crc: crcKey }))
    .digest("hex");

  try {
    const verifyResponse = await fetch(`${baseUrl}/api/v1/transaction/verify`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${posId}:${apiKey}`).toString("base64"),
      },
      body: JSON.stringify({
        merchantId: Number(merchantId), posId: Number(posId),
        sessionId, amount: Number(amount), currency,
        orderId: Number(orderId), sign: verifySign,
      }),
    });

    const verifyData = await verifyResponse.json();
    if (verifyData.data !== true) {
      console.error("P24 verify failed:", verifyData);
      return res.status(200).end();
    }
  } catch (e) {
    console.error("P24 verify error:", e);
    return res.status(200).end();
  }

  const { error } = await supabase.from("bookings")
    .update({ payment_status: "paid" })
    .eq("payment_session_id", sessionId)
    .eq("payment_status", "pending");

  if (error) console.error("Booking update error:", error.message);
  return res.status(200).end();
}
