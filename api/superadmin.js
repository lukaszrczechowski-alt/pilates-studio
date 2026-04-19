import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mask(str) {
  if (!str) return "";
  if (str.length <= 4) return "••••";
  return "••••" + str.slice(-4);
}

function generatePassword() {
  return crypto.randomBytes(10).toString("base64url").slice(0, 14);
}

function buildFeatures(plan) {
  const base = { tokens_enabled: true, multi_staff: false, service_mode: "classes" };
  if (plan === "pro") return { ...base, multi_staff: true, multilingual: true };
  if (plan === "studio") return { ...base, multi_staff: true, multilingual: true, max_clients: 500 };
  return base;
}

async function getProfile(userId) {
  const { data } = await supabase.from("profiles").select("role, studio_id").eq("id", userId).single();
  return data || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Provision (no auth token, uses PROVISION_SECRET) ──────────────────────
  if (req.method === "POST" && req.query.action === "provision") {
    const { secret, name, slug, email, plan } = req.body || {};
    if (!secret || secret !== process.env.PROVISION_SECRET)
      return res.status(401).json({ error: "Unauthorized" });
    if (!name || !slug || !email)
      return res.status(400).json({ error: "Brak wymaganych pól: name, slug, email" });

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!cleanSlug) return res.status(400).json({ error: "Nieprawidłowy slug" });

    const { data: existing } = await supabase.from("studios").select("id").eq("slug", cleanSlug).maybeSingle();
    if (existing) return res.status(409).json({ error: `Subdomena "${cleanSlug}" jest już zajęta` });

    const domain = `${cleanSlug}.studiova.app`;
    const features = buildFeatures(plan || "starter");

    const { data: studio, error: studioError } = await supabase
      .from("studios").insert({ name, slug: cleanSlug, domain, features }).select().single();
    if (studioError) return res.status(500).json({ error: "Błąd tworzenia studia: " + studioError.message });

    const password = generatePassword();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authError) {
      await supabase.from("studios").delete().eq("id", studio.id);
      return res.status(500).json({ error: "Błąd tworzenia konta: " + authError.message });
    }

    const userId = authData.user.id;
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId, email, first_name: name, last_name: "", role: "admin", studio_id: studio.id,
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("studios").delete().eq("id", studio.id);
      return res.status(500).json({ error: "Błąd tworzenia profilu: " + profileError.message });
    }

    return res.status(200).json({ ok: true, studio_id: studio.id, slug: cleanSlug, domain, email, password, login_url: `https://${domain}` });
  }

  // ── All other actions require Bearer token ─────────────────────────────────
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const profile = await getProfile(user.id);
  if (!profile) return res.status(403).json({ error: "Forbidden" });

  const isSuperAdmin = profile.role === "superadmin";
  const isAdmin = ["admin", "superadmin"].includes(profile.role);

  // ── Payment config (GET/POST ?action=payment-config) ──────────────────────
  if (req.query.action === "payment-config") {
    if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
    const studioId = profile.studio_id;

    if (req.method === "GET") {
      const { data: studio } = await supabase.from("studios").select("payment_config").eq("id", studioId).single();
      const cfg = studio?.payment_config || {};
      return res.json({
        p24: {
          merchant_id: cfg.p24?.merchant_id || "",
          pos_id: cfg.p24?.pos_id || "",
          api_key: mask(cfg.p24?.api_key),
          crc_key: mask(cfg.p24?.crc_key),
          sandbox: cfg.p24?.sandbox !== false,
          configured: !!(cfg.p24?.merchant_id && cfg.p24?.api_key && cfg.p24?.crc_key),
        },
        stripe: {
          publishable_key: cfg.stripe?.publishable_key || "",
          secret_key: mask(cfg.stripe?.secret_key),
          configured: !!(cfg.stripe?.secret_key),
        },
      });
    }

    if (req.method === "POST") {
      const { provider, config } = req.body || {};
      if (!provider || !config) return res.status(400).json({ error: "Brak danych" });

      const { data: studio } = await supabase.from("studios").select("payment_config").eq("id", studioId).single();
      const current = studio?.payment_config || {};
      let updated = { ...current };

      if (provider === "p24") {
        updated.p24 = { ...current.p24 };
        if (config.merchant_id !== undefined) updated.p24.merchant_id = config.merchant_id;
        if (config.pos_id !== undefined) updated.p24.pos_id = config.pos_id;
        if (config.sandbox !== undefined) updated.p24.sandbox = config.sandbox;
        if (config.api_key && !config.api_key.startsWith("••")) updated.p24.api_key = config.api_key;
        if (config.crc_key && !config.crc_key.startsWith("••")) updated.p24.crc_key = config.crc_key;
      }
      if (provider === "stripe") {
        updated.stripe = { ...current.stripe };
        if (config.publishable_key !== undefined) updated.stripe.publishable_key = config.publishable_key;
        if (config.secret_key && !config.secret_key.startsWith("••")) updated.stripe.secret_key = config.secret_key;
      }

      const { error } = await supabase.from("studios").update({ payment_config: updated }).eq("id", studioId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    return res.status(405).end();
  }

  // ── Action-based requests (POST body.action) ───────────────────────────────
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, payload } = req.body || {};

  const superAdminOnly = ["list_studios", "get_stats", "create_studio", "delete_studio"];
  if (superAdminOnly.includes(action) && !isSuperAdmin)
    return res.status(403).json({ error: "Forbidden" });
  if (action === "update_own_studio" && !isAdmin)
    return res.status(403).json({ error: "Forbidden" });

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

        const { data: current } = await supabase
          .from("studios").select("branding, features").eq("id", studioId).single();

        const mergedBranding = { ...(current?.branding || {}), ...(branding || {}) };
        const mergedFeatures = isSuperAdmin
          ? { ...(current?.features || {}), ...(features || {}) }
          : {
              ...(current?.features || {}),
              tokens_enabled: features?.tokens_enabled,
              multi_staff: features?.multi_staff,
              service_mode: features?.service_mode,
            };

        const { data, error } = await supabase
          .from("studios")
          .update({ name, branding: mergedBranding, features: mergedFeatures })
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
