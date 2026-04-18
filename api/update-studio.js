import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, studio_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, branding, features } = req.body || {};
  const studioId = profile.studio_id;
  if (!studioId) return res.status(400).json({ error: "No studio assigned" });

  // Superadmin może edytować wszystkie flagi; admin tylko bezpieczny podzbiór
  const allowedFeatures = profile.role === "superadmin"
    ? features
    : { tokens_enabled: features?.tokens_enabled, multi_staff: features?.multi_staff };

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (branding !== undefined) updates.branding = branding;
  if (allowedFeatures !== undefined) updates.features = allowedFeatures;

  const { data, error } = await supabase
    .from("studios")
    .update(updates)
    .eq("id", studioId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}
