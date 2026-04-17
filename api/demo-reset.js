import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_SLUG = "demo";

const FICTIONAL_CLIENTS = [
  { email: "kasia.nowak@demo.studiova.app",      first_name: "Kasia",      last_name: "Nowak",        phone: null,          birth_date: "1992-03-15" },
  { email: "monika.wisniewski@demo.studiova.app", first_name: "Monika",     last_name: "Wiśniewska",   phone: "501234567",   birth_date: "1988-07-22" },
  { email: "agnieszka.k@demo.studiova.app",       first_name: "Agnieszka",  last_name: "Kowalczyk",    phone: "512345678",   birth_date: "1995-11-08" },
  { email: "natalia.d@demo.studiova.app",         first_name: "Natalia",    last_name: "Dąbrowska",    phone: null,          birth_date: "1990-05-30" },
  { email: "zofia.l@demo.studiova.app",           first_name: "Zofia",      last_name: "Lewandowska",  phone: "523456789",   birth_date: "1997-01-14" },
  { email: "marta.z@demo.studiova.app",           first_name: "Marta",      last_name: "Zielińska",    phone: "534567890",   birth_date: "1985-09-03" },
];

function buildClasses(studioId, now) {
  const d = (offsetDays, hour, minute = 0) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + offsetDays);
    dt.setHours(hour, minute, 0, 0);
    return dt.toISOString();
  };

  return [
    // Minione — 10 zajęć z ostatnich 6 tygodni
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(-42, 10),    duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(-38, 18),    duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    { name: "Stretching & Relaks",      starts_at: d(-35, 9),     duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates Power",            starts_at: d(-33, 17, 30),duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(-28, 10),    duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(-21, 18),    duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    { name: "Stretching & Relaks",      starts_at: d(-14, 9),     duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates Power",            starts_at: d(-12, 17, 30),duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(-7, 10),     duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(-3, 18),     duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    // Nadchodzące — 12 zajęć
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(1, 10),      duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(2, 18),      duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    { name: "Stretching & Relaks",      starts_at: d(4, 9),       duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates Power",            starts_at: d(5, 17, 30),  duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(8, 10),      duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(9, 18),      duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    { name: "Stretching & Relaks",      starts_at: d(11, 9),      duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates Power",            starts_at: d(12, 17, 30), duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy",  starts_at: d(15, 10),     duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",   starts_at: d(16, 18),     duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 0,  studio_id: studioId },
    { name: "Stretching & Relaks",      starts_at: d(18, 9),      duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0,  studio_id: studioId },
    { name: "Pilates Power",            starts_at: d(19, 17, 30), duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, studio_id: studioId },
  ];
}

async function ensureClient(client, studioId) {
  // Sprawdź czy user już istnieje w auth
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === client.email);

  let userId;
  if (found) {
    userId = found.id;
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: client.email,
      password: "DemoKlient2024!",
      email_confirm: true,
      user_metadata: { first_name: client.first_name, last_name: client.last_name },
    });
    if (error) return null;
    userId = created.user.id;
  }

  // Upsert profilu
  await supabase.from("profiles").upsert({
    id: userId,
    email: client.email,
    first_name: client.first_name,
    last_name: client.last_name,
    phone: client.phone,
    birth_date: client.birth_date,
    role: "client",
    studio_id: studioId,
  }, { onConflict: "id" });

  return userId;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Pobierz studio demo
  const { data: studio, error: studioErr } = await supabase
    .from("studios")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .single();

  if (studioErr || !studio) {
    return res.status(404).json({ error: "Studio demo nie istnieje. Dodaj rekord do tabeli studios z slug='demo'." });
  }

  const studioId = studio.id;

  // Upewnij się że wszyscy fikcyjni klienci istnieją
  const clientIds = [];
  for (const client of FICTIONAL_CLIENTS) {
    const id = await ensureClient(client, studioId);
    if (id) clientIds.push(id);
  }

  // Pobierz admina demo
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("studio_id", studioId)
    .eq("role", "admin")
    .single();

  const demoAdminId = adminProfile?.id;

  // Wyczyść dane demo (kolejność ważna przez FK)
  const tables = [
    "attendance", "class_messages", "class_ratings",
    "notifications", "token_history", "tokens",
    "waitlist", "bookings", "classes",
  ];
  for (const table of tables) {
    await supabase.from(table).delete().eq("studio_id", studioId);
  }

  // Wstaw zajęcia
  const now = new Date();
  const { data: insertedClasses, error: classErr } = await supabase
    .from("classes")
    .insert(buildClasses(studioId, now))
    .select("id, starts_at, name");

  if (classErr) {
    return res.status(500).json({ error: "Błąd wstawiania zajęć", detail: classErr.message });
  }

  const past = insertedClasses.filter(c => new Date(c.starts_at) < now);
  const upcoming = insertedClasses.filter(c => new Date(c.starts_at) >= now);

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const ratings = [5, 5, 4, 5, 4, 4, 5, 3, 5, 4];
  const comments = [
    "Świetne zajęcia, bardzo polecam!",
    "Instruktorka świetnie tłumaczy każde ćwiczenie.",
    "Dobry poziom, miła atmosfera.",
    "Wychodzę rozciągnięta i zrelaksowana — dokładnie tego potrzebowałam!",
    "Zajęcia bardzo dobrze poprowadzone, na pewno wróćę.",
    "Super tempo, czuję każdy mięsień!",
    "Najlepsze zajęcia w tygodniu, polecam każdemu.",
    "Trochę za intensywnie jak na mój poziom, ale dałam radę.",
    "Piękna sala, świetna instruktorka, wracam w przyszłym tygodniu.",
    "Idealne na rozruszanie po pracy.",
  ];

  // Rozłóż dane na wszystkich klientów
  for (let i = 0; i < clientIds.length; i++) {
    const userId = clientIds[i];

    // Tokeny miesięczne
    const tokenAmount = 6 + (i % 5);
    await supabase.from("tokens").insert({ user_id: userId, month, year, amount: tokenAmount, studio_id: studioId });
    await supabase.from("token_history").insert({
      user_id: userId, operation: "add", amount: tokenAmount,
      month, year, note: "Karnet miesięczny", studio_id: studioId,
    });

    // Każdy klient był na innych minionych zajęciach (rotacyjnie)
    const myPast = past.filter((_, idx) => idx % clientIds.length === i || idx % 3 === i % 3);
    for (const cls of myPast) {
      await supabase.from("bookings").insert({
        class_id: cls.id, user_id: userId,
        payment_method: "entries", payment_status: "free", studio_id: studioId,
      });
      await supabase.from("attendance").insert({
        class_id: cls.id, user_id: userId, status: "present", studio_id: studioId,
      });
      await supabase.from("class_ratings").insert({
        class_id: cls.id, user_id: userId,
        rating: ratings[(i + myPast.indexOf(cls)) % ratings.length],
        comment: comments[(i + myPast.indexOf(cls)) % comments.length],
        studio_id: studioId,
      });
    }

    // Każdy klient zapisany na 2–3 nadchodzące zajęcia
    const myUpcoming = upcoming.filter((_, idx) => idx % 2 === i % 2).slice(0, 3);
    for (const cls of myUpcoming) {
      await supabase.from("bookings").insert({
        class_id: cls.id, user_id: userId,
        payment_method: i % 2 === 0 ? "entries" : "cash", payment_status: "free", studio_id: studioId,
      });
    }

    // Powiadomienie powitalne
    await supabase.from("notifications").insert({
      user_id: userId, type: "booking",
      message: "Witaj w Studiova! Zapraszamy na pierwsze zajęcia.",
      studio_id: studioId,
    });
  }

  // Wiadomość admina do pierwszych nadchodzących zajęć
  if (demoAdminId && upcoming[0]) {
    await supabase.from("class_messages").insert({
      class_id: upcoming[0].id,
      message: "Pamiętajcie o wygodnym stroju i macie! Do zobaczenia.",
      sent_by: demoAdminId,
      studio_id: studioId,
    });
    for (const userId of clientIds) {
      await supabase.from("notifications").insert({
        user_id: userId, type: "booking",
        class_id: upcoming[0].id,
        message: `Wiadomość od instruktora: "Pamiętajcie o wygodnym stroju i macie! Do zobaczenia"`,
        studio_id: studioId,
      });
    }
  }

  // Szablony zajęć
  await supabase.from("class_templates").delete().eq("studio_id", studioId);
  await supabase.from("class_templates").insert([
    { name: "Pilates Ogólnorozwojowy", duration_min: 60, max_spots: 10, location: "Sala A", notes: "Zajęcia dla wszystkich poziomów", studio_id: studioId },
    { name: "Pilates dla Kręgosłupa",  duration_min: 60, max_spots: 8,  location: "Sala B", notes: "Skupiamy się na stabilizacji i rozciąganiu", studio_id: studioId },
    { name: "Stretching & Relaks",     duration_min: 45, max_spots: 12, location: "Sala A", notes: "Idealne zakończenie tygodnia", studio_id: studioId },
    { name: "Pilates Power",           duration_min: 60, max_spots: 8,  location: "Sala B", price_pln: 80, notes: "Zaawansowane ćwiczenia z obciążeniem", studio_id: studioId },
  ]);

  return res.status(200).json({
    ok: true,
    studio_id: studioId,
    clients: clientIds.length,
    classes: insertedClasses.length,
    past: past.length,
    upcoming: upcoming.length,
    reset_at: now.toISOString(),
  });
}
