import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAuthUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

async function isSuperAdmin(userId) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "superadmin";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!(await isSuperAdmin(user.id))) return res.status(403).json({ error: "Forbidden" });

  const { action, payload } = req.body || {};

  try {
    switch (action) {
      case "list_studios": {
        const { data, error } = await supabase
          .from("studios")
          .select("*")
          .order("created_at");
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
        const { data, error } = await supabase
          .from("studios")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return res.json({ data });
      }

      case "update_studio": {
        const { id, ...updates } = payload;
        const { data, error } = await supabase
          .from("studios")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return res.json({ data });
      }

      case "delete_studio": {
        const { id } = payload;
        const { error } = await supabase.from("studios").delete().eq("id", id);
        if (error) throw error;
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
