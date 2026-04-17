import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const domain = req.query.domain;
  if (!domain) return res.status(400).json({ error: "Missing domain" });

  // Najpierw szukaj po custom domain
  let { data: studio } = await supabase
    .from("studios")
    .select("id, name, slug, domain, features")
    .eq("domain", domain)
    .maybeSingle();

  // Jeśli nie ma custom domain — spróbuj subdomenę *.studiova.app
  if (!studio) {
    const sub = domain.replace(".studiova.app", "");
    if (sub !== domain) {
      ({ data: studio } = await supabase
        .from("studios")
        .select("id, name, slug, domain, features")
        .eq("slug", sub)
        .maybeSingle());
    }
  }

  if (!studio) return res.status(404).json({ error: "Studio not found" });

  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json(studio);
}
