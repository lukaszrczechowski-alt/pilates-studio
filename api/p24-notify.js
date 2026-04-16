import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { merchantId, posId, sessionId, amount, currency, orderId, sign } = req.body;
  const crcKey = process.env.P24_CRC_KEY;
  const apiKey = process.env.P24_API_KEY;
  const sandbox = process.env.P24_SANDBOX === "true";
  const baseUrl = sandbox
    ? "https://sandbox.przelewy24.pl"
    : "https://secure.przelewy24.pl";

  // Weryfikacja podpisu P24 — orderId to liczba
  const expectedSign = crypto
    .createHash("sha384")
    .update(JSON.stringify({ sessionId, orderId: Number(orderId), amount: Number(amount), currency, crc: crcKey }))
    .digest("hex");

  if (sign !== expectedSign) {
    console.error("P24 notify: nieprawidłowy podpis");
    return res.status(400).end();
  }

  // Potwierdź transakcję u P24
  const verifySign = crypto
    .createHash("sha384")
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
        merchantId: Number(merchantId),
        posId: Number(posId),
        sessionId,
        amount: Number(amount),
        currency,
        orderId: Number(orderId),
        sign: verifySign,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.data !== true) {
      console.error("P24 verify failed:", verifyData);
      // Zawsze odpowiadamy 200 do P24, bo inaczej będzie powtarzał próby
      return res.status(200).end();
    }
  } catch (e) {
    console.error("P24 verify error:", e);
    return res.status(200).end();
  }

  // Aktywuj rezerwację
  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("payment_session_id", sessionId)
    .eq("payment_status", "pending");

  if (error) console.error("Booking update error:", error.message);

  return res.status(200).end();
}
