import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@studiobypaulina.pl";

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { userIds, title, body, url = "/" } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0 || !title) {
    return res.status(400).json({ error: "Missing or invalid userIds / title" });
  }

  // Pobierz subskrypcje użytkowników
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, push_subscription")
    .in("id", userIds)
    .not("push_subscription", "is", null);

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0, failed = 0;
  for (const profile of profiles || []) {
    try {
      const sub = JSON.parse(profile.push_subscription);
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url }));
      sent++;
    } catch (e) {
      console.error("Push send error:", e.message);
      // Jeśli subskrypcja nieważna (410 Gone) — usuń ją
      if (e.statusCode === 410) {
        await supabase.from("profiles").update({ push_subscription: null }).eq("id", profile.id);
      }
      failed++;
    }
  }

  return res.status(200).json({ sent, failed });
}
