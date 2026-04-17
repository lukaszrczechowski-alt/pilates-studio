# Pilates Studio App — kontekst projektu

Aplikacja SaaS multi-tenant dla studiów fitness/pilates. Pierwsza instalacja: studio Pauliny. Kolejne studia dodawane przez rejestrację domeny/subdomeny — bez zmian w kodzie.

## Stack

- **Frontend:** React 18.2.0 + Vite 5.0.0
- **Baza danych + auth:** Supabase (PostgreSQL, RLS, triggery)
- **Deploy:** Vercel (auto-deploy przy push na `main`, Cron jobs)
- **Płatności:** Przelewy24 (P24)
- **Emaile:** Nodemailer (Gmail SMTP) via `api/contact.js`; `emailService.js` woła `supabase.functions.invoke("send-email")` (Edge Function — niezaimplementowana)
- **SMS:** SMSAPI (Polska)
- **Push:** Web Push API + VAPID

## Struktura plików

```
src/
  App.jsx                  # routing + auth state + StudioContext
  App.css                  # design system — tokeny, komponenty
  supabase.js              # klient Supabase
  emailService.js          # wysyłka emaili (supabase.functions)
  smsService.js            # helper SMS (sendSms, smsDate)
  pages/
    LandingPage.jsx        # strona główna (one-pager, bez auth)
    AuthPage.jsx           # logowanie / rejestracja / reset hasła
    ClientDashboard.jsx    # panel klienta
    AdminDashboard.jsx     # panel Pauliny (admin)
    PublicBooking.jsx      # /zapisy — publiczna lista zajęć + formularz kontaktowy
api/
  get-studio.js            # GET — domain → studio (multi-tenant routing)
  create-user.js           # POST — admin tworzy konto klienta
  p24-create.js            # POST — inicjuje płatność P24
  p24-notify.js            # POST — webhook P24 (potwierdza płatność)
  push-subscribe.js        # POST — zapisuje subskrypcję Web Push
  push-send.js             # POST — wysyła push do listy userId
  send-sms.js              # POST — wysyła SMS przez SMSAPI
  contact.js               # POST — formularz kontaktowy (email + notyfikacja)
  remind-classes.js        # GET Cron 07:00 UTC — SMS przypomnienia na jutro
  birthday-wishes.js       # GET Cron 08:00 UTC — życzenia urodzinowe
public/
  sw.js                    # Service Worker — obsługa push events
```

## Routing (App.jsx)

| Ścieżka | Komponent | Auth | Opis |
|---------|-----------|------|------|
| `/` | LandingPage | Brak | Strona główna |
| `/` (authMode) | AuthPage | Brak | Modal logowania/rejestracji |
| `/` (klient) | ClientDashboard | Wymagany | Panel klienta |
| `/` (admin) | AdminDashboard | Admin | Panel administracyjny |
| `/zapisy` | PublicBooking | Brak | Publiczny grafik + kontakt |

Po zalogowaniu: `profile.role === "admin"` → AdminDashboard, inaczej ClientDashboard.

## Multi-tenant / SaaS

**Domain routing:**
- `StudioContext.jsx` — przy ładowaniu woła `/api/get-studio?domain=<hostname>`
- Priorytet: custom domain (np. `paulapilates.pl`) → subdomena (np. `paula.studiova.app` → slug `paula`)
- `studio_id` trafia do kontekstu, przekazywany do wszystkich zapytań

**RLS isolation:**
- Wszystkie tabele mają `studio_id`
- Funkcja SQL `auth_studio_id()` zwraca `studio_id` zalogowanego użytkownika
- Polityki RLS: `studio_id = auth_studio_id()` — użytkownicy widzą tylko swoje studio

**Onboarding nowego studia:**
1. Dodaj rekord do `studios` (name, slug, domain)
2. Skieruj domenę na Vercel
3. Zarejestruj konto admin — `studio_id` przypisywany automatycznie na podstawie domeny

## Baza danych (Supabase)

### Tabele

**studios**
```
id, name, slug (UNIQUE), domain (UNIQUE), features (JSONB), created_at
```

**profiles** (rozszerza auth.users)
```
id, first_name, last_name, email, phone, birth_date,
role (client|admin), admin_notes, push_subscription,
studio_id (FK studios, NOT NULL), created_at
```

**classes**
```
id, name, starts_at, duration_min (def 60), max_spots (def 10),
location, notes, price_pln, venue_cost_pln,
cancelled (BOOL), cancel_reason,
series_id, series_index,
studio_id (FK studios, NOT NULL), created_at
```

**bookings**
```
id, class_id (FK CASCADE), user_id (FK CASCADE),
payment_method (cash|entries|online),
payment_status (free|pending|paid),
payment_session_id,
studio_id (FK studios, NOT NULL), created_at
UNIQUE(class_id, user_id)
```

**waitlist**
```
id, class_id, user_id, studio_id, created_at
```

**tokens** (karnety)
```
id, user_id, month, year, amount,
studio_id, created_at, updated_at
```

**token_history**
```
id, user_id, class_id, operation (add|use|expire),
amount, month, year, note, studio_id, created_at
```

**notifications**
```
id, user_id, type (booking|class_cancelled|tokens_added|birthday|contact),
class_id, message, read (BOOL), studio_id, created_at
```

**class_ratings**
```
id, class_id, user_id, rating (1-5), comment,
studio_id, created_at
UNIQUE(class_id, user_id)
```

**class_messages**
```
id, class_id, message, sent_by, studio_id, created_at
```

**class_templates**
```
id, name, duration_min, max_spots, location, notes,
price_pln, venue_cost_pln, studio_id, created_at
```

**attendance**
```
id, class_id, user_id, status (present|absent),
studio_id, created_at
```

### Triggery PostgreSQL
- `notify_on_booking` — powiadomienie przy zapisie
- `notify_on_cancel` — powiadomienie przy wypisaniu
- Formy bezosobowe: "Zapisano: X Y na zajęcia..." / "Wypisano: X Y z zajęć..."

### Wymagane SQL (jeśli brakuje kolumn)
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscription TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'free';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_session_id TEXT;
```

## API Endpoints

| Endpoint | Metoda | Auth | Opis |
|----------|--------|------|------|
| `/api/get-studio` | GET | Brak | Domain → studio (cache 60s) |
| `/api/create-user` | POST | Brak* | Admin tworzy konto klienta |
| `/api/p24-create` | POST | JWT | Inicjuje płatność P24 |
| `/api/p24-notify` | POST | Podpis P24 | Webhook potwierdzający płatność |
| `/api/push-subscribe` | POST | JWT | Zapisuje subskrypcję push |
| `/api/push-send` | POST | Brak* | Wysyła push do userId[] |
| `/api/send-sms` | POST | Brak* | Wysyła SMS przez SMSAPI |
| `/api/contact` | POST | CORS | Formularz kontaktowy |
| `/api/remind-classes` | GET | CRON_SECRET | Cron — przypomnienia SMS |
| `/api/birthday-wishes` | GET | CRON_SECRET | Cron — życzenia SMS |

*wywoływane tylko z backendu/admina, nieeksponowane publicznie

## Funkcjonalności

### Rezerwacje
- Metody płatności: gotówka, karnet (entries), online (P24)
- Zajęcia cykliczne: `series_id` grupuje serie; checkbox "Zapisz na wszystkie"
- Anulowanie: bezpłatne do 12:00 w dniu zajęć; po 12:00 — utrata wejścia z karnetu
- Awans z kolejki: przy anulowaniu pierwsza osoba z waitlist auto-awansuje (email + SMS)

### Tokeny / Karnety
- Miesięczna pula wejść (month, year, amount)
- Token_history: pełny audit log (add/use/expire)
- Admin może ręcznie dodawać/korygować wejścia

### Płatności P24
- Tylko gdy `price_pln > 0`
- Flow: Booking `pending` → P24 → webhook → `paid`
- Po płatności redirect na `/?platnosc=ok`
- Rollback bookingu jeśli rejestracja P24 nie powiedzie się

### Powiadomienia (in-app)
- Typy: booking, class_cancelled, tokens_added, birthday, contact
- Oznaczanie: jedno / wszystkie jako przeczytane

### Push Notifications
- Opt-in: klient rejestruje Service Worker
- Subskrypcja w `profiles.push_subscription`
- Auto-usuwanie subskrypcji przy 410 Gone
- Triggery: anulowanie zajęć, tokeny, urodziny, wiadomości admina

### SMS
- Opt-in: klient podaje numer w profilu
- Normalizacja numeru: `48XXXXXXXXX`
- Polskie znaki → ASCII (GSM-7, limit ~100 znaków)
- Triggery: anulowanie zajęć, awans z kolejki, przypomnienie (cron 07:00 UTC), urodziny (cron 08:00 UTC), wiadomości admina

### Oceny zajęć
- 1–5 gwiazdek + komentarz
- Tylko po zakończeniu zajęć
- Jedna ocena na użytkownika na zajęcia (UPDATE jeśli istnieje)

### Zarządzanie zajęciami (admin)
- CRUD + serie tygodniowe
- Edycja serii: "Zastosuj do wszystkich" → aktualizuje wszystkie powiązane
- Anulowanie: refund tokenów, powiadomienia (in-app/email/SMS/push)
- Szablony: presety zajęć (nazwa, czas, miejsca, lokalizacja, cena)

### Frekwencja
- Admin zaznacza obecny/nieobecny
- Drukowanie listy (HTML printout)

### Panel klienta
- Zakładki: zajęcia, moje rezerwacje, kolejki, tokeny, powiadomienia, oceny, konto
- Widok kalendarza (desktop) / lista (mobile)

### Panel admina
- Zakładki: grafik, klienci, rezerwacje, finanse, powiadomienia, szablony, raporty, wiadomości
- Raporty: łączna liczba zajęć, rezerwacji, unikalnych klientów, raport miesięczny
- Zarządzanie klientami: dodawanie, edycja, notatki, historia tokenów

## Role użytkowników

- **client** — ClientDashboard; może: rezerwować, anulować, dołączyć do kolejki, oceniać, edytować profil
- **admin** — AdminDashboard; może: wszystko + zarządzanie zajęciami, klientami, tokenami, raportami

Rola ustawiana ręcznie w bazie: `UPDATE profiles SET role = 'admin' WHERE id = '...'`

## Design system (App.css)

### Kolory (CSS variables)
```
--cream: #F7F3EE          tło główne
--warm-white: #FDFAF6     tło kart, sidebar
--sage: #8A9E85           główny akcent (zielony)
--sage-light: #B8CBAF
--sage-dark: #5C7A56
--clay: #C4917A           akcent drugorzędny (terakota)
--clay-light: #E8C5B5
--charcoal: #2C2C2C       tekst główny
--mid: #6B6B6B            tekst pomocniczy
--light: #ADADAD          tekst trzeciorzędny
--border: #E8E0D8         obramowania
--shadow: rgba(44,44,44,0.08)
```

### Fonty
- **Cormorant Garamond** — nagłówki h1–h4, elementy dekoracyjne
- **DM Sans** — body, przyciski, UI

### Komponenty CSS
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm`, `.btn-full`
- `.card`, `.cards-grid`
- `.class-card`, `.class-card-header`, `.class-card-body`
- `.modal`, `.modal-overlay`, `.modal-header`, `.modal-close`
- `.sidebar`, `.nav-item`, `.main-content`
- `.form-group`, `.form-label`, `.form-input`
- `.alert`, `.alert-success`, `.alert-error`
- `.landing-*` — komponenty landing page
- Responsive: mobile (≤768px) → lista + dolna nawigacja `.mobile-nav`
- Dark mode: `[data-theme="dark"]` (toggle w obu dashboardach, localStorage)

## Deployment (Vercel)

**vercel.json:**
```json
{
  "buildCommand": "npx vite build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "crons": [
    { "path": "/api/remind-classes", "schedule": "0 7 * * *" },
    { "path": "/api/birthday-wishes", "schedule": "0 8 * * *" }
  ]
}
```

**Env vars Vercel:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_APP_URL                    # np. https://studiobypaulina.pl

P24_MERCHANT_ID
P24_POS_ID
P24_CRC_KEY
P24_API_KEY
P24_SANDBOX                     # true / false

VITE_VAPID_PUBLIC_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT                   # mailto:... (opcjonalny)

SMSAPI_TOKEN
GMAIL_USER
GMAIL_APP_PASSWORD              # 16-znak. hasło aplikacji Google
CONTACT_EMAIL                   # docelowy email z formularza kontaktowego

CRON_SECRET                     # token do auth cronów
```

## Zasady pracy

- **Po każdym zadaniu: commit + push automatycznie** (bez pytania)
- **Język UI: polski**, formy bezosobowe — nie żeńskie (np. "Zapisano" nie "Zapisałaś")
- Nie dodawać funkcji poza zakresem zadania
- Nie tworzyć nowych plików jeśli można edytować istniejące
- Strefa czasowa: Europe/Warsaw (hard-coded w cronach i SMS)

## Znane ograniczenia

- Email: `emailService.js` woła Edge Function `send-email` — niezaimplementowana; tylko `api/contact.js` (nodemailer/Gmail) działa niezawodnie
- Push: nie działa w Safari iOS poza trybem Web App
- Płatności: tylko P24 (brak innych bramek)
- Storage: brak upload plików — wszystko w PostgreSQL
