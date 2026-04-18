import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getProfile(userId) {
  const { data } = await supabase.from("profiles").select("role, studio_id").eq("id", userId).single();
  return data || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfile(user.id);
  if (!profile) return res.status(403).json({ error: "Forbidden" });

  const isSuperAdmin = profile.role === "superadmin";
  const isAdmin = ["admin", "superadmin"].includes(profile.role);

  const { action, payload } = req.body || {};

  // Akcje tylko dla superadmina
  const superAdminOnly = ["list_studios", "get_stats", "create_studio", "delete_studio"];
  if (superAdminOnly.includes(action) && !isSuperAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Akcja update_own_studio — dla każdego admina (tylko swoje studio)
  if (action === "update_own_studio" && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    switch (action) {
      case "list_studios": {
        const { data, error } = await supabase.from("studios").select("*").order("created_at");
        if (error) throw error;
        return res.json({ data });
      }

      case "get_stats": {
        const [p, c, b] = await Promise.all([
          supabase.from("profiles").select("studio_id"),
          supabase.from("classes").select("studio_id"),
          supabase.from("bookings").select("studio_id"),
        ]);
        const stats = {};
        const inc = (sid, key) => {
          if (!sid) return;
          if (!stats[sid]) stats[sid] = { profiles: 0, classes: 0, bookings: 0 };
          stats[sid][key]++;
        };
        (p.data || []).forEach(r => inc(r.studio_id, "profiles"));
        (c.data || []).forEach(r => inc(r.studio_id, "classes"));
        (b.data || []).forEach(r => inc(r.studio_id, "bookings"));
        return res.json({ data: stats });
      }

      case "create_studio": {
        const { data, error } = await supabase.from("studios").insert(payload).select().single();
        if (error) throw error;
        return res.json({ data });
      }

      case "update_studio": {
        const { id, ...updates } = payload;
        const { data, error } = await supabase.from("studios").update(updates).eq("id", id).select().single();
        if (error) throw error;
        return res.json({ data });
      }

      case "delete_studio": {
        const { error } = await supabase.from("studios").delete().eq("id", payload.id);
        if (error) throw error;
        return res.json({ success: true });
      }

      case "update_own_studio": {
        const studioId = profile.studio_id;
        if (!studioId) throw new Error("No studio assigned");
        const { name, branding, features } = payload;
        const allowedFeatures = isSuperAdmin
          ? features
          : { ...(features || {}), is_demo: undefined };
        const { data, error } = await supabase
          .from("studios")
          .update({ name, branding, features: allowedFeatures })
          .eq("id", studioId)
          .select()
          .single();
        if (error) throw error;
        return res.json({ data });
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
