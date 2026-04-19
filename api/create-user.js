import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getMaxClients(studioId) {
  const { data: studio } = await supabase.from("studios").select("plan_id, features").eq("id", studioId).maybeSingle();
  const studioMax = studio?.features?.max_clients;
  if (studioMax) return Number(studioMax);
  if (studio?.plan_id) {
    const { data: plan } = await supabase.from("plans").select("features").eq("id", studio.plan_id).maybeSingle();
    const planMax = plan?.features?.max_clients;
    if (planMax) return Number(planMax);
  }
  return null;
}

async function isAdmin(token) {
  if (!token) return false;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return ["admin", "superadmin"].includes(p?.role);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!await isAdmin(token)) return res.status(403).json({ error: "Forbidden" });

  const { first_name, last_name, email, phone, birth_date, studioId } = req.body;
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: "Imię, nazwisko i email są wymagane." });
  }

  if (studioId) {
    const maxClients = await getMaxClients(studioId);
    if (maxClients !== null) {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("role", "client");
      if (count >= maxClients) return res.status(400).json({ error: `Osiągnięto limit ${maxClients} klientów dla tego studia.` });
    }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name, last_name },
  });

  if (error) {
    const msg = error.message.includes("already registered")
      ? "Użytkownik z tym emailem już istnieje."
      : error.message;
    return res.status(400).json({ error: msg });
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    first_name,
    last_name,
    email,
    phone: phone || null,
    birth_date: birth_date || null,
    role: "client",
    ...(studioId ? { studio_id: studioId } : {}),
  });

  return res.status(200).json({ id: data.user.id });
}
