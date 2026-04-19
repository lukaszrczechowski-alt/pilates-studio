import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getStudio(domain) {
  let { data: studio } = await supabase
    .from("studios")
    .select("id, name, slug, domain, features, branding")
    .eq("domain", domain)
    .maybeSingle();

  if (!studio) {
    const sub = domain.replace(".studiova.app", "");
    if (sub !== domain) {
      ({ data: studio } = await supabase
        .from("studios")
        .select("id, name, slug, domain, features, branding")
        .eq("slug", sub)
        .maybeSingle());
    }
  }
  return studio;
}

export default async function handler(req, res) {
  const domain = (req.headers.host || "").replace(/:\d+$/, "");
  const studio = await getStudio(domain);

  const name = studio?.name || "Studio";
  const b = studio?.branding || {};
  const letter = (name[0] || "S").toUpperCase();
  const isDemo = studio?.features?.is_demo === true;

  const heroEyebrow = escHtml(b.hero_eyebrow || name);
  const heroTitle   = escHtml(b.hero_title   || "Zadbaj o siebie.");
  const heroSub     = escHtml(b.hero_sub     || "Rezerwuj zajęcia online w kilku kliknięciach.");
  const navName     = escHtml(b.nav_name     || name);
  const logoUrl     = b.logo_url ? escHtml(b.logo_url) : null;
  const year        = new Date().getFullYear();

  const ctaHref = isDemo ? "/login" : "/register";
  const ctaText = isDemo ? "Zaloguj się do demo" : "Zarezerwuj miejsce";

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escHtml(name)}" style="height:38px;max-width:160px;object-fit:contain;">`
    : `<div class="logo-letter">${letter}</div><span class="logo-name">${navName}</span>`;

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(name)}</title>
  <meta name="description" content="${heroSub}">
  <meta property="og:title" content="${escHtml(name)}">
  <meta property="og:description" content="${heroSub}">
  <meta property="og:type" content="website">
  ${logoUrl ? `<meta property="og:image" content="${logoUrl}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --cream:#F7F3EE;--sage:#8A9E85;--sage-light:#B8CBAF;--sage-dark:#5C7A56;
      --charcoal:#2C2C2C;--mid:#6B6B6B;--light:#ADADAD;--border:#E8E0D8;
    }
    body{font-family:'DM Sans',sans-serif;background:var(--cream);height:100vh;overflow:hidden}
    a{text-decoration:none;color:inherit}
    .wrap{height:100vh;display:flex;flex-direction:column;overflow:hidden}
    nav{display:flex;justify-content:space-between;align-items:center;padding:1rem 2rem;border-bottom:1px solid var(--border);flex-shrink:0}
    .logo{display:flex;align-items:center;gap:.5rem}
    .logo-letter{width:32px;height:32px;border-radius:50%;background:var(--sage);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:.9rem}
    .logo-name{font-weight:500;font-size:.95rem;color:var(--charcoal)}
    .nav-actions{display:flex;gap:.5rem;align-items:center}
    .btn{display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:6px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;transition:opacity .15s;text-decoration:none}
    .btn:hover{opacity:.82}
    .btn-sm{padding:.4rem .85rem;font-size:.82rem}
    .btn-lg{padding:.75rem 1.75rem;font-size:.95rem}
    .btn-secondary{background:transparent;border:1px solid var(--border);color:var(--charcoal)}
    .btn-primary{background:var(--sage);color:#fff}
    .hero{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
    .hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--cream) 50%,var(--sage-light) 100%);opacity:.5}
    .hero-deco{position:absolute;inset:0;pointer-events:none}
    .circle{position:absolute;border-radius:50%;background:var(--sage-light);opacity:.3}
    .c1{width:min(420px,60vw);height:min(420px,60vw);bottom:-20%;right:-10%}
    .c2{width:min(200px,30vw);height:min(200px,30vw);top:10%;left:-5%}
    .big-letter{position:absolute;bottom:-2rem;right:5%;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(8rem,22vw,18rem);opacity:.06;color:var(--charcoal);line-height:1;user-select:none}
    .hero-content{position:relative;z-index:2;text-align:center;padding:1.5rem 2rem;max-width:600px}
    .eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.2em;color:var(--sage-dark);font-weight:500;margin-bottom:1rem}
    h1{font-family:'Cormorant Garamond',serif;font-size:clamp(3rem,8vw,5.5rem);font-weight:300;line-height:1.05;color:var(--charcoal);margin-bottom:1.25rem}
    .sub{font-size:1rem;color:var(--mid);line-height:1.7;margin:0 auto 2rem;max-width:440px}
    .ctas{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
    footer{flex-shrink:0;padding:.75rem 2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--light)}
    @media(max-width:480px){
      nav{padding:.75rem 1rem}
      .nav-actions .hide-mobile{display:none}
    }
  </style>
</head>
<body>
<div class="wrap">
  <nav>
    <div class="logo">${logoHtml}</div>
    <div class="nav-actions">
      <a href="/zapisy" class="btn btn-secondary btn-sm hide-mobile">Harmonogram</a>
      <a href="/login" class="btn btn-secondary btn-sm">Zaloguj się</a>
      ${!isDemo ? `<a href="/register" class="btn btn-primary btn-sm">Dołącz</a>` : ""}
    </div>
  </nav>
  <div class="hero">
    <div class="hero-bg"></div>
    <div class="hero-deco">
      <div class="circle c1"></div>
      <div class="circle c2"></div>
      <div class="big-letter">${letter}</div>
    </div>
    <div class="hero-content">
      <p class="eyebrow">${heroEyebrow}</p>
      <h1>${heroTitle}</h1>
      <p class="sub">${heroSub}</p>
      <div class="ctas">
        <a href="${ctaHref}" class="btn btn-primary btn-lg">${ctaText}</a>
        <a href="/zapisy" class="btn btn-secondary btn-lg">Zobacz harmonogram</a>
      </div>
    </div>
  </div>
  <footer>
    <span>${navName}</span>
    <span>© ${year} ${escHtml(name)}</span>
  </footer>
</div>
<script>
  // Jeśli użytkownik jest już zalogowany → przekieruj do aplikacji
  try {
    var keys = Object.keys(localStorage);
    var tokenKey = keys.find(function(k){ return k.indexOf('-auth-token') !== -1; });
    if (tokenKey) {
      var raw = localStorage.getItem(tokenKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.access_token) {
          window.location.replace('/app');
        }
      }
    }
  } catch(e){}
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  return res.status(200).send(html);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
