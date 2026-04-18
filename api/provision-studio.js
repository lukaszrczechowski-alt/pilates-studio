import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { secret, name, slug, email, plan } = req.body || {};

  // Weryfikacja sekretu
  if (!secret || secret !== process.env.PROVISION_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Walidacja wymaganych pól
  if (!name || !slug || !email) {
    return res.status(400).json({ error: "Brak wymaganych pól: name, slug, email" });
  }

  // Normalizacja slug — tylko małe litery, cyfry i myślniki
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!cleanSlug) return res.status(400).json({ error: "Nieprawidłowy slug" });

  // Sprawdź czy slug już zajęty
  const { data: existing } = await supabase
    .from("studios")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: `Subdomena "${cleanSlug}" jest już zajęta` });
  }

  // Utwórz studio
  const domain = `${cleanSlug}.studiova.app`;
  const features = buildFeatures(plan || "starter");

  const { data: studio, error: studioError } = await supabase
    .from("studios")
    .insert({ name, slug: cleanSlug, domain, features })
    .select()
    .single();

  if (studioError) {
    return res.status(500).json({ error: "Błąd tworzenia studia: " + studioError.message });
  }

  // Utwórz konto admina
  const password = generatePassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // Rollback studio
    await supabase.from("studios").delete().eq("id", studio.id);
    return res.status(500).json({ error: "Błąd tworzenia konta: " + authError.message });
  }

  const userId = authData.user.id;

  // Utwórz profil admina
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      email,
      first_name: name,
      last_name: "",
      role: "admin",
      studio_id: studio.id,
    });

  if (profileError) {
    // Rollback
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from("studios").delete().eq("id", studio.id);
    return res.status(500).json({ error: "Błąd tworzenia profilu: " + profileError.message });
  }

  return res.status(200).json({
    ok: true,
    studio_id: studio.id,
    slug: cleanSlug,
    domain,
    email,
    password,
    login_url: `https://${domain}`,
  });
}

function generatePassword() {
  return crypto.randomBytes(10).toString("base64url").slice(0, 14);
}

function buildFeatures(plan) {
  const base = { tokens_enabled: true, multi_staff: false, service_mode: "classes" };
  if (plan === "pro") return { ...base, multi_staff: true, multilingual: true };
  if (plan === "studio") return { ...base, multi_staff: true, multilingual: true, max_clients: 500 };
  return base; // starter
}
