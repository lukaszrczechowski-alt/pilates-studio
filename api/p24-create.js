import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { classId } = req.body;
  if (!classId) return res.status(400).json({ error: "Brak classId" });

  // Pobierz zajęcia
  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id, name, starts_at, price_pln, max_spots")
    .eq("id", classId)
    .maybeSingle();

  if (classError || !cls) return res.status(404).json({ error: "Nie znaleziono zajęć" });
  if (!cls.price_pln || cls.price_pln <= 0) return res.status(400).json({ error: "Zajęcia nie mają ustawionej ceny" });

  // Sprawdź czy już zapisany
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: "Masz już rezerwację na te zajęcia" });

  // Sprawdź dostępność miejsc
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  if (count >= cls.max_spots) return res.status(409).json({ error: "Brak wolnych miejsc" });

  // Pobierz profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const sessionId = `${user.id.replace(/-/g, "").slice(0, 8)}-${classId.replace(/-/g, "").slice(0, 8)}-${Date.now()}`;
  const amount = Math.round(cls.price_pln * 100); // w groszach

  // Utwórz rezerwację ze statusem "pending"
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      class_id: classId,
      user_id: user.id,
      payment_method: "online",
      payment_status: "pending",
      payment_session_id: sessionId,
    })
    .select()
    .single();

  if (bookingError) return res.status(500).json({ error: bookingError.message });

  // Konfiguracja P24
  const merchantId = Number(process.env.P24_MERCHANT_ID);
  const posId = Number(process.env.P24_POS_ID || process.env.P24_MERCHANT_ID);
  const crcKey = process.env.P24_CRC_KEY;
  const apiKey = process.env.P24_API_KEY;
  const sandbox = process.env.P24_SANDBOX === "true";
  const baseUrl = sandbox
    ? "https://sandbox.przelewy24.pl"
    : "https://secure.przelewy24.pl";
  const appUrl = process.env.VITE_APP_URL;

  const sign = crypto
    .createHash("sha384")
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
        merchantId,
        posId,
        sessionId,
        amount,
        currency: "PLN",
        description: `Zajęcia: ${cls.name}`,
        email: profile?.email || user.email,
        country: "PL",
        language: "pl",
        urlReturn: `${appUrl}/?platnosc=ok&session=${sessionId}`,
        urlStatus: `${appUrl}/api/p24-notify`,
        sign,
      }),
    });

    const p24Data = await response.json();

    if (!p24Data.data?.token) {
      // Cofnij rezerwację jeśli P24 odrzucił
      await supabase.from("bookings").delete().eq("id", booking.id);
      console.error("P24 register error:", p24Data);
      return res.status(500).json({ error: "Błąd rejestracji płatności w P24" });
    }

    return res.status(200).json({
      redirectUrl: `${baseUrl}/trnRequest/${p24Data.data.token}`,
    });
  } catch (e) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    console.error("P24 fetch error:", e);
    return res.status(500).json({ error: "Błąd połączenia z P24" });
  }
}
