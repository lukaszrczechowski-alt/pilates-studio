import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getStudio(domain) {
  // Próbuj obu wariantów: z www i bez
  const bare = domain.replace(/^www\./, "");
  const candidates = [domain, bare, `www.${bare}`].filter((v, i, a) => a.indexOf(v) === i);

  for (const d of candidates) {
    const { data } = await supabase
      .from("studios")
      .select("id, name, slug, domain, features, branding")
      .eq("domain", d)
      .maybeSingle();
    if (data) return data;
  }

  // Subdomena *.studiova.app
  const sub = bare.replace(".studiova.app", "");
  if (sub !== bare) {
    const { data } = await supabase
      .from("studios")
      .select("id, name, slug, domain, features, branding")
      .eq("slug", sub)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

export default async function handler(req, res) {
  const domain = (req.headers["x-forwarded-host"] || req.headers.host || "").replace(/:\d+$/, "").split(",")[0].trim();
  const studio = await getStudio(domain);

  const name     = studio?.name || "Studio";
  const b        = studio?.branding || {};
  const f        = studio?.features || {};
  const letter   = (name[0] || "S").toUpperCase();
  const isDemo   = f.is_demo === true;
  const template = f.landing_template || "minimal";

  const sage      = b.colors?.sage     || "#8A9E85";
  const sageLight = "#B8CBAF";
  const sageDark  = "#5C7A56";
  const clay      = b.colors?.clay     || "#C4917A";
  const cream     = b.colors?.cream    || "#F7F3EE";
  const charcoal  = b.colors?.charcoal || "#2C2C2C";
  const mid       = b.colors?.mid      || "#6B6B6B";
  const border    = "#E8E0D8";
  const light     = "#ADADAD";

  const heroEyebrow = escHtml(b.hero_eyebrow || name);
  const heroTitle   = escHtml(b.hero_title   || "Zadbaj o siebie.");
  const heroSub     = escHtml(b.hero_sub     || "Rezerwuj zajęcia online w kilku kliknięciach.");
  const navName     = escHtml(b.nav_name     || name);
  const logoUrl     = b.logo_url ? escHtml(b.logo_url) : null;
  const year        = new Date().getFullYear();
  const ctaHref     = isDemo ? "/login" : "/register";
  const ctaText     = isDemo ? "Zaloguj się do demo" : "Zarezerwuj miejsce";

  const navSub = b.nav_name && b.nav_name !== name ? `<div class="logo-sub">${escHtml(b.nav_name)}</div>` : "";
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${escHtml(name)}" style="height:40px;max-width:160px;object-fit:contain;">`
    : `<div class="logo-letter">${letter}</div><div><div class="logo-name">${escHtml(name)}</div>${navSub}</div>`;

  const logoHtmlWhite = logoUrl
    ? `<img src="${logoUrl}" alt="${escHtml(name)}" style="height:44px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1);">`
    : `<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-family:'Cormorant Garamond',serif;font-size:2rem;color:white;">${letter}</div>
       <div style="font-family:'Cormorant Garamond',serif;font-size:clamp(1.4rem,2.5vw,2rem);font-weight:300;color:white;letter-spacing:.08em;">${navName}</div>`;

  const baseCss = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --sage:${sage};--sage-light:${sageLight};--sage-dark:${sageDark};
      --clay:${clay};--cream:${cream};--charcoal:${charcoal};
      --mid:${mid};--border:${border};--light:${light};
    }
    body{font-family:'DM Sans',sans-serif;background:var(--cream)}
    a{text-decoration:none;color:inherit}
    .btn{display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:6px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:500;transition:opacity .15s;text-decoration:none}
    .btn:hover{opacity:.82}
    .btn-sm{padding:.4rem .85rem;font-size:.82rem}
    .btn-lg{padding:.75rem 1.75rem;font-size:.95rem}
    .btn-secondary{background:transparent;border:1px solid var(--border);color:var(--charcoal)}
    .btn-primary{background:var(--sage);color:#fff}
    h1{font-family:'Cormorant Garamond',serif;font-weight:300;line-height:1.05;color:var(--charcoal)}
    h2{font-family:'Cormorant Garamond',serif;font-weight:400;color:var(--charcoal)}
  `;

  const sessionScript = `<script>
  try {
    var keys = Object.keys(localStorage);
    var tokenKey = keys.find(function(k){ return k.indexOf('-auth-token') !== -1; });
    if (tokenKey) {
      var raw = localStorage.getItem(tokenKey);
      if (raw) { var parsed = JSON.parse(raw); if (parsed && parsed.access_token) window.location.replace('/app'); }
    }
  } catch(e){}
  <\/script>`;

  const head = (extraStyle = "") => `<!DOCTYPE html>
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
  <style>${baseCss}${extraStyle}</style>
</head>
<body>`;

  // ── MINIMAL ────────────────────────────────────────────────────────────────
  if (template === "minimal") {
    const html = head(`
      body{height:100vh;overflow:hidden}
      .wrap{height:100vh;display:flex;flex-direction:column;overflow:hidden}
      nav{display:flex;justify-content:space-between;align-items:center;height:64px;padding:0 2.5rem;border-bottom:1px solid var(--border);flex-shrink:0}
      .logo{display:flex;align-items:center;gap:.5rem}
      .logo-letter{width:40px;height:40px;border-radius:50%;background:#8A9E85;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:300;flex-shrink:0}
      .logo-name{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:300;color:#2C2C2C;letter-spacing:.05em;line-height:1.1}
      .logo-sub{font-size:.68rem;color:#8A9E85;letter-spacing:.15em;text-transform:uppercase;line-height:1}
      .nav-actions{display:flex;gap:.5rem;align-items:center}
      .hero{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
      .hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--cream) 50%,var(--sage-light) 100%);opacity:.5}
      .hero-deco{position:absolute;inset:0;pointer-events:none}
      .c1{position:absolute;width:min(420px,60vw);height:min(420px,60vw);bottom:-20%;right:-10%;border-radius:50%;background:var(--sage-light);opacity:.3}
      .c2{position:absolute;width:min(200px,30vw);height:min(200px,30vw);top:10%;left:-5%;border-radius:50%;background:var(--sage-light);opacity:.3}
      .big-letter{position:absolute;bottom:-2rem;right:5%;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(8rem,22vw,18rem);opacity:.06;color:var(--charcoal);line-height:1;user-select:none}
      .hero-content{position:relative;z-index:2;text-align:center;padding:1.5rem 2rem;max-width:600px}
      .eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.2em;color:var(--sage-dark);font-weight:500;margin-bottom:1rem}
      h1{font-size:clamp(3rem,8vw,5.5rem);margin-bottom:1.25rem}
      .sub{font-size:1rem;color:var(--mid);line-height:1.7;margin:0 auto 2rem;max-width:440px}
      .ctas{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
      footer{flex-shrink:0;padding:.75rem 2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--light)}
      @media(max-width:480px){nav{padding:.75rem 1rem}.hide-m{display:none}}
    `) + `
<div class="wrap">
  <nav>
    <a href="/" class="logo" style="text-decoration:none;">${logoHtml}</a>
    <div class="nav-actions">
      <a href="/zapisy" class="btn btn-secondary btn-sm hide-m">Harmonogram</a>
      <a href="?lang=en" class="btn btn-secondary btn-sm">EN</a>
      <a href="/login" class="btn btn-secondary btn-sm">Zaloguj się</a>
      ${!isDemo ? `<a href="${ctaHref}" class="btn btn-primary btn-sm">Dołącz</a>` : ""}
    </div>
  </nav>
  <div class="hero">
    <div class="hero-bg"></div>
    <div class="hero-deco"><div class="c1"></div><div class="c2"></div><div class="big-letter">${letter}</div></div>
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
  <footer><span>${navName}</span><span>© ${year} ${escHtml(name)}</span></footer>
</div>
${sessionScript}</body></html>`;
    return send(res, html);
  }

  // ── BOLD (split-screen) ────────────────────────────────────────────────────
  if (template === "bold") {
    const html = head(`
      body{height:100vh;overflow:hidden;display:flex}
      .left{width:42%;flex-shrink:0;background:var(--sage);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden}
      .left-deco{position:absolute;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(10rem,28vw,22rem);color:rgba(255,255,255,.1);line-height:1;bottom:-2rem;right:-1rem;user-select:none}
      .left-content{position:relative;z-index:2;text-align:center;padding:2rem}
      .left-divider{width:40px;height:1px;background:rgba(255,255,255,.4);margin:1.5rem auto}
      .left-eyebrow{font-size:.72rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.2em}
      .right{flex:1;background:var(--cream);display:flex;flex-direction:column;overflow:hidden}
      .right-nav{display:flex;justify-content:flex-end;align-items:center;gap:.5rem;height:64px;padding:0 2rem;border-bottom:1px solid var(--border);flex-shrink:0}
      .right-hero{flex:1;display:flex;align-items:center;padding:2rem 3rem}
      h1{font-size:clamp(2.8rem,5vw,4.5rem);margin-bottom:1.25rem}
      .sub{font-size:1rem;color:var(--mid);line-height:1.75;margin-bottom:2.5rem;max-width:400px}
      .ctas{display:flex;gap:.75rem;flex-wrap:wrap}
      footer{flex-shrink:0;padding:.75rem 2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--light)}
      @media(max-width:640px){body{flex-direction:column}.left{width:100%;height:180px}.left-deco{font-size:8rem}.right-hero{padding:1.5rem}}
    `) + `
<div class="left">
  <div class="left-deco">${letter}</div>
  <a href="/" class="left-content" style="text-decoration:none;display:block;">
    ${logoHtmlWhite}
    <div class="left-divider"></div>
    <p class="left-eyebrow">${heroEyebrow}</p>
  </a>
</div>
<div class="right">
  <div class="right-nav">
    <a href="/zapisy" class="btn btn-secondary btn-sm">Harmonogram</a>
    <a href="/login" class="btn btn-secondary btn-sm">Zaloguj się</a>
    ${!isDemo ? `<a href="${ctaHref}" class="btn btn-primary btn-sm">Dołącz</a>` : ""}
  </div>
  <div class="right-hero">
    <div style="max-width:480px">
      <h1>${heroTitle}</h1>
      <p class="sub">${heroSub}</p>
      <div class="ctas">
        <a href="${ctaHref}" class="btn btn-primary btn-lg">${ctaText}</a>
        <a href="/zapisy" class="btn btn-secondary btn-lg">Zobacz harmonogram</a>
      </div>
    </div>
  </div>
  <footer><span>${navName}</span><span>© ${year} ${escHtml(name)}</span></footer>
</div>
${sessionScript}</body></html>`;
    return send(res, html);
  }

  // ── CLASSIC (full scrollable page) ────────────────────────────────────────
  const html = head(`
    body{min-height:100vh}
    nav{display:flex;justify-content:space-between;align-items:center;height:64px;padding:0 2.5rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(247,243,238,.95);backdrop-filter:blur(8px);z-index:100}
    .logo{display:flex;align-items:center;gap:.5rem}
    .logo-letter{width:32px;height:32px;border-radius:50%;background:var(--sage);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:500;font-size:.9rem}
    .logo-name{font-weight:500;font-size:.95rem;color:var(--charcoal)}
    .nav-actions{display:flex;gap:.5rem;align-items:center}
    .hero{padding:5rem 2rem 4rem;text-align:center;position:relative;overflow:hidden;background:linear-gradient(135deg,var(--cream) 60%,var(--sage-light) 100%)}
    .hero-letter{position:absolute;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(10rem,30vw,24rem);opacity:.06;color:var(--charcoal);bottom:-2rem;right:3%;line-height:1;user-select:none}
    .hero-inner{position:relative;z-index:2;max-width:640px;margin:0 auto}
    .eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.2em;color:var(--sage-dark);font-weight:500;margin-bottom:1rem}
    h1{font-size:clamp(2.8rem,7vw,5rem);margin-bottom:1.25rem}
    .sub{font-size:1rem;color:var(--mid);line-height:1.7;margin-bottom:2.5rem}
    .ctas{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap}
    .section{padding:4rem 2rem;max-width:900px;margin:0 auto}
    .section-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.18em;color:var(--sage-dark);font-weight:600;margin-bottom:.6rem}
    h2{font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:2rem}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.25rem}
    .card{background:white;border:1px solid var(--border);border-radius:12px;padding:1.5rem}
    .card-icon{font-size:1.5rem;margin-bottom:.75rem}
    .card h3{font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:600;color:var(--charcoal);margin-bottom:.5rem}
    .card p{font-size:.875rem;color:var(--mid);line-height:1.6}
    .steps{display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap}
    .step{flex:1;min-width:160px;text-align:center}
    .step-num{width:44px;height:44px;border-radius:50%;background:var(--sage);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1.1rem;margin:0 auto .75rem}
    .step h3{font-family:'DM Sans',sans-serif;font-weight:600;margin-bottom:.35rem;font-size:.95rem}
    .step p{font-size:.85rem;color:var(--mid)}
    .step-arrow{font-size:1.5rem;color:var(--border);padding-top:.8rem;flex-shrink:0}
    .alt{background:white}
    .cta-section{background:var(--sage);padding:4rem 2rem;text-align:center}
    .cta-section h2{color:white;margin-bottom:.75rem}
    .cta-section p{color:rgba(255,255,255,.8);margin-bottom:2rem;font-size:.95rem}
    .btn-white{background:white;color:var(--sage)}
    footer{padding:1.5rem 2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--light)}
    @media(max-width:480px){nav{padding:.75rem 1rem}.hide-m{display:none}.step-arrow{display:none}}
  `) + `
<nav>
  <div class="logo">${logoHtml}</div>
  <div class="nav-actions">
    <a href="/zapisy" class="btn btn-secondary btn-sm hide-m">Harmonogram</a>
    <a href="/login" class="btn btn-secondary btn-sm">Zaloguj się</a>
    ${!isDemo ? `<a href="${ctaHref}" class="btn btn-primary btn-sm">Dołącz</a>` : ""}
  </div>
</nav>
<div class="hero">
  <div class="hero-letter">${letter}</div>
  <div class="hero-inner">
    <p class="eyebrow">${heroEyebrow}</p>
    <h1>${heroTitle}</h1>
    <p class="sub">${heroSub}</p>
    <div class="ctas">
      <a href="${ctaHref}" class="btn btn-primary btn-lg">${ctaText}</a>
      <a href="/zapisy" class="btn btn-secondary btn-lg">Zobacz harmonogram</a>
    </div>
  </div>
</div>
<div class="section">
  <p class="section-label">Co oferujemy</p>
  <h2>Znajdź zajęcia dla siebie</h2>
  <div class="cards">
    <div class="card"><div class="card-icon">🌱</div><h3>Dla początkujących</h3><p>Spokojne tempo, nauka poprawnej techniki. Idealne do startu.</p></div>
    <div class="card"><div class="card-icon">✨</div><h3>Ogólnorozwojowe</h3><p>Pełna praca ciała, wzmacnianie core, elastyczność.</p></div>
    <div class="card"><div class="card-icon">🔥</div><h3>Zaawansowane</h3><p>Intensywniejszy trening dla osób z doświadczeniem.</p></div>
  </div>
</div>
<div class="alt">
  <div class="section">
    <p class="section-label">Jak to działa</p>
    <h2>Trzy kroki do zajęć</h2>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><h3>Załóż konto</h3><p>Rejestracja zajmuje minutę.</p></div>
      <div class="step-arrow">→</div>
      <div class="step"><div class="step-num">2</div><h3>Wybierz termin</h3><p>Przeglądaj i zapisz się jednym kliknięciem.</p></div>
      <div class="step-arrow">→</div>
      <div class="step"><div class="step-num">3</div><h3>Przyjdź i ćwicz</h3><p>Dostaniesz potwierdzenie. Do zobaczenia!</p></div>
    </div>
  </div>
</div>
<div class="cta-section">
  <h2>${escHtml(b.cta_title || "Gotowa, żeby zacząć?")}</h2>
  <p>${escHtml(b.cta_sub || "Dołącz do studia — pierwsze kroki są najważniejsze.")}</p>
  <a href="${ctaHref}" class="btn btn-white btn-lg">${isDemo ? "Zaloguj się do demo" : "Zarejestruj się za darmo"}</a>
</div>
<footer><span>${navName}</span><span>© ${year} ${escHtml(name)}. Wszelkie prawa zastrzeżone.</span></footer>
${sessionScript}</body></html>`;
  return send(res, html);
}

function send(res, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
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
