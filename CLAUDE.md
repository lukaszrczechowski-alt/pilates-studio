# Pilates Studio — kontekst projektu

Aplikacja webowa dla studia pilates prowadzonego przez Paulinę. Klienci zapisują się na zajęcia online, Paulina zarządza grafikiem.

## Stack

- **Frontend:** React + Vite
- **Baza danych + auth:** Supabase (PostgreSQL, RLS, triggery)
- **Deploy:** Vercel (auto-deploy przy każdym push na `main`)
- **Emaile:** własny emailService.js

## Struktura plików

```
src/
  App.jsx                  # routing (landing / auth / dashboardy)
  App.css                  # wszystkie style, design tokens
  supabase.js              # klient Supabase
  emailService.js          # wysyłka emaili
  pages/
    LandingPage.jsx        # strona główna (one-pager, bez auth)
    AuthPage.jsx           # logowanie / rejestracja / reset hasła
    ClientDashboard.jsx    # panel klienta
    AdminDashboard.jsx     # panel Pauliny (admin)
    PublicBooking.jsx      # /zapisy — publiczna lista zajęć
```

## Routing (App.jsx)

- `/` → LandingPage (zawsze, bez logowania)
- `/` + klik "Zaloguj się" → AuthPage (stan `authMode`)
- Po zalogowaniu → ClientDashboard lub AdminDashboard (zależnie od `profile.role`)
- `/zapisy` → PublicBooking (publiczne, bez auth)

## Baza danych (Supabase)

### Tabele
- `profiles` — użytkownicy (first_name, last_name, email, role: client|admin)
- `classes` — zajęcia (name, starts_at, duration_min, max_spots, location, notes, price_pln, venue_cost_pln, cancelled, series_id)
- `bookings` — rezerwacje (class_id, user_id, payment_method: cash|entries)
- `waitlist` — lista oczekujących
- `tokens` — wejścia z karnetu (user_id, month, year, amount)
- `token_history` — historia operacji na wejściach
- `notifications` — powiadomienia (type, class_id, user_id, message, read)
- `class_ratings` — oceny zajęć (class_id, user_id, rating, comment)
- `class_messages` — wiadomości od admina do uczestników
- `class_templates` — szablony zajęć

### Triggery PostgreSQL
- `notify_on_booking` — tworzy powiadomienie przy zapisie na zajęcia
- `notify_on_cancel` — tworzy powiadomienie przy wypisaniu z zajęć
- Formy bezosobowe: "Zapisano: X Y na zajęcia..." / "Wypisano: X Y z zajęć..."

## Design system (App.css)

### Kolory (CSS variables)
```
--cream: #F7F3EE        tło główne
--warm-white: #FDFAF6   tło kart, sidebar
--sage: #8A9E85         główny akcent (zielony)
--sage-light: #B8CBAF
--sage-dark: #5C7A56
--clay: #C4917A         akcent drugorzędny (terakota)
--charcoal: #2C2C2C     tekst główny
--mid: #6B6B6B          tekst pomocniczy
--border: #E8E0D8       obramowania
```

### Fonty
- **Cormorant Garamond** — nagłówki (h1–h4), elementy dekoracyjne
- **DM Sans** — body, przyciski, UI

### Komponenty CSS
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`
- `.card`, `.cards-grid`
- `.class-card`, `.class-card-header`, `.class-card-body`
- `.sidebar`, `.nav-item`, `.main-content`
- `.modal`, `.modal-overlay`
- `.landing-*` — komponenty landing page
- Responsive: mobile (≤768px) z dolną nawigacją `.mobile-nav`
- Dark mode: `[data-theme="dark"]`

## Zasady pracy

- **Po każdym zadaniu: commit + push automatycznie** (bez pytania)
- **Język UI: polski**, formy bezosobowe — nie żeńskie (np. "Zapisano" nie "Zapisałaś")
- Nie dodawać funkcji poza zakresem zadania
- Nie tworzyć nowych plików jeśli można edytować istniejące

## Role użytkowników

- **client** — widzi ClientDashboard: zajęcia, rezerwacje, powiadomienia, konto
- **admin** (Paulina) — widzi AdminDashboard: kalendarz, klienci, finanse, szablony, powiadomienia

## SMS (SMSAPI)

- `api/send-sms.js` — Vercel serverless, wywołuje SMSAPI, ukrywa token
- `api/remind-classes.js` — Vercel Cron, codziennie 07:00 UTC (9:00 PL), wysyła przypomnienia na jutro
- `src/smsService.js` — helper frontendowy (`sendSms`, `smsDate`)
- Pole `phone` w tabeli `profiles` — opt-in: klient wpisuje numer w zakładce Konto
- Triggery SMS: odwołanie zajęć (admin), awans z kolejki, przypomnienie dzień przed
- Env vars: `SMSAPI_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (Vercel), `CRON_SECRET` (opcjonalny)

## Znane szczegóły

- Anulowanie zajęć po 12:00 w dniu zajęć = utrata wejścia z karnetu
- Klient może oceniać minione zajęcia (1–5 gwiazdek)
- Admin może wysyłać wiadomości do uczestników zajęć
- Admin może tworzyć zajęcia cykliczne (serie tygodniowe)
- Minione zajęcia w modalu klienta: tylko "✓ Zajęcia odbyły się" — bez przycisku anulowania
