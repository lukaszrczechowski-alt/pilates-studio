import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_SLUG = "demo";

// Dane szablonowe — zajęcia generowane względem daty resetu
function buildClasses(studioId, now) {
  const d = (offsetDays, hour, minute = 0) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + offsetDays);
    dt.setHours(hour, minute, 0, 0);
    return dt.toISOString();
  };

  return [
    // Minione (do ocen i historii)
    { name: "Pilates Ogólnorozwojowy", starts_at: d(-14, 10), duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates dla Kręgosłupa", starts_at: d(-10, 18), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 0, studio_id: studioId },
    { name: "Stretching & Relaks", starts_at: d(-7, 9), duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy", starts_at: d(-3, 10), duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0, studio_id: studioId },
    // Nadchodzące
    { name: "Pilates Ogólnorozwojowy", starts_at: d(1, 10), duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates dla Kręgosłupa", starts_at: d(2, 18), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 0, studio_id: studioId },
    { name: "Stretching & Relaks", starts_at: d(4, 9), duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates Power", starts_at: d(5, 17, 30), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy", starts_at: d(8, 10), duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates dla Kręgosłupa", starts_at: d(9, 18), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 0, studio_id: studioId },
    { name: "Stretching & Relaks", starts_at: d(11, 9), duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates Power", starts_at: d(12, 17, 30), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 80, studio_id: studioId },
    { name: "Pilates Ogólnorozwojowy", starts_at: d(15, 10), duration_min: 60, max_spots: 10, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates dla Kręgosłupa", starts_at: d(16, 18), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 0, studio_id: studioId },
    { name: "Stretching & Relaks", starts_at: d(18, 9), duration_min: 45, max_spots: 12, location: "Sala A", price_pln: 0, studio_id: studioId },
    { name: "Pilates Power", starts_at: d(19, 17, 30), duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 80, studio_id: studioId },
  ];
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

  // Pobierz profile demo_user i demo_admin
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("studio_id", studioId);

  const demoAdmin = profiles?.find(p => p.role === "admin");
  const demoUser = profiles?.find(p => p.role === "client");

  // Wyczyść dane demo (kolejność ważna przez FK)
  const tables = [
    "attendance", "class_messages", "class_ratings",
    "notifications", "token_history", "tokens",
    "waitlist", "bookings", "classes",
  ];
  for (const table of tables) {
    await supabase.from(table).delete().eq("studio_id", studioId);
  }

  // Wstaw szablonowe zajęcia
  const now = new Date();
  const classRows = buildClasses(studioId, now);

  const { data: insertedClasses, error: classErr } = await supabase
    .from("classes")
    .insert(classRows)
    .select("id, starts_at, name");

  if (classErr) {
    return res.status(500).json({ error: "Błąd wstawiania zajęć", detail: classErr.message });
  }

  // Indeksuj zajęcia: minione i nadchodzące
  const past = insertedClasses.filter(c => new Date(c.starts_at) < now);
  const upcoming = insertedClasses.filter(c => new Date(c.starts_at) >= now);

  if (demoUser && demoAdmin) {
    // Tokeny dla demo_user — 8 wejść w bieżącym miesiącu
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await supabase.from("tokens").insert({
      user_id: demoUser.id, month, year, amount: 8, studio_id: studioId,
    });
    await supabase.from("token_history").insert({
      user_id: demoUser.id, operation: "add", amount: 8,
      month, year, note: "Karnet miesięczny — demo", studio_id: studioId,
    });

    // Rezerwacje demo_user na minione zajęcia (karnet)
    for (const cls of past) {
      await supabase.from("bookings").insert({
        class_id: cls.id, user_id: demoUser.id,
        payment_method: "entries", payment_status: "free", studio_id: studioId,
      });
    }

    // Rezerwacje demo_user na 3 nadchodzące zajęcia
    for (const cls of upcoming.slice(0, 3)) {
      await supabase.from("bookings").insert({
        class_id: cls.id, user_id: demoUser.id,
        payment_method: "entries", payment_status: "free", studio_id: studioId,
      });
    }

    // Oceny minionych zajęć
    const ratings = [5, 4, 5, 4];
    const comments = [
      "Świetne zajęcia, bardzo polecam!",
      "Dobry poziom, miła atmosfera.",
      "Instruktor super tłumaczy każde ćwiczenie.",
      "Wyjdę bardziej rozciągnięta — dokładnie o to chodziło!",
    ];
    for (let i = 0; i < past.length; i++) {
      await supabase.from("class_ratings").insert({
        class_id: past[i].id, user_id: demoUser.id,
        rating: ratings[i % ratings.length],
        comment: comments[i % comments.length],
        studio_id: studioId,
      });
    }

    // Powiadomienie powitalne
    await supabase.from("notifications").insert({
      user_id: demoUser.id, type: "booking",
      message: "Witaj w demo Studiova! Możesz przeglądać grafik, rezerwować zajęcia i sprawdzić swój karnet.",
      studio_id: studioId,
    });

    // Wiadomość admina do pierwszych nadchodzących zajęć
    if (upcoming[0]) {
      await supabase.from("class_messages").insert({
        class_id: upcoming[0].id,
        message: "Pamiętajcie o wygodnym stroju i macie! Do zobaczenia 🧘",
        sent_by: demoAdmin.id,
        studio_id: studioId,
      });
      await supabase.from("notifications").insert({
        user_id: demoUser.id, type: "booking",
        class_id: upcoming[0].id,
        message: `Wiadomość od instruktora: "Pamiętajcie o wygodnym stroju i macie! Do zobaczenia"`,
        studio_id: studioId,
      });
    }

    // Frekwencja na minionych (wszyscy obecni)
    for (const cls of past) {
      await supabase.from("attendance").insert({
        class_id: cls.id, user_id: demoUser.id,
        status: "present", studio_id: studioId,
      });
    }
  }

  // Szablony zajęć
  await supabase.from("class_templates").delete().eq("studio_id", studioId);
  await supabase.from("class_templates").insert([
    { name: "Pilates Ogólnorozwojowy", duration_min: 60, max_spots: 10, location: "Sala A", notes: "Zajęcia dla wszystkich poziomów", studio_id: studioId },
    { name: "Pilates dla Kręgosłupa", duration_min: 60, max_spots: 8, location: "Sala B", notes: "Skupiamy się na stabilizacji i rozciąganiu", studio_id: studioId },
    { name: "Stretching & Relaks", duration_min: 45, max_spots: 12, location: "Sala A", notes: "Idealne zakończenie tygodnia", studio_id: studioId },
    { name: "Pilates Power", duration_min: 60, max_spots: 8, location: "Sala B", price_pln: 80, notes: "Zaawansowane ćwiczenia z obciążeniem", studio_id: studioId },
  ]);

  return res.status(200).json({
    ok: true,
    studio_id: studioId,
    classes: insertedClasses.length,
    past: past.length,
    upcoming: upcoming.length,
    reset_at: now.toISOString(),
  });
}
