import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, subscription } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: "Missing userId or subscription" });

  const { error } = await supabase.from("profiles")
    .update({ push_subscription: JSON.stringify(subscription) })
    .eq("id", userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
