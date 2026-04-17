# Studiova — Przegląd techniczny

> Aplikacja webowa do zarządzania studiem fitness/pilates/fizjoterapii.  
> Wersja: single-tenant (jedna instancja = jedno studio).

---

## Stack

| Warstwa | Technologia | Dlaczego |
|---|---|---|
| Frontend | React 18 + Vite | Szybki dev, małe bundle, SPA bez SSR (wystarczy) |
| Styling | CSS custom properties (App.css) | Brak zależności od UI lib, pełna kontrola nad design tokenami |
| Backend/DB | Supabase (PostgreSQL) | Auth + DB + RLS + realtime w jednym, BaaS bez własnego serwera |
| Auth | Supabase Auth (email/hasło + magic link) | Wbudowany, JWT, obsługuje role przez profiles.role |
| Deploy | Vercel | Auto-deploy z GitHub, serverless functions bez konfiguracji |
| Email | Gmail SMTP (nodemailer) przez Vercel Function | Prosty, zero kosztów do ~500 maili/dzień |
| SMS | SMSAPI.pl przez Vercel Function | Polski operator, tania wysyłka, API REST |
| Push | Web Push (VAPID) + Service Worker | Powiadomienia bez aplikacji mobilnej |
| Płatności | Przelewy24 | Najpopularniejsza bramka PL, webhook-based |

---

## Struktura plików

```
pilates-app/
├── src/
│   ├── App.jsx              # routing + auth state
│   ├── App.css              # cały design system (tokeny, komponenty)
│   ├── supabase.js          # klient Supabase (anon key)
│   ├── emailService.js      # helper: sendEmail()
│   ├── smsService.js        # helper: sendSms()
│   └── pages/
│       ├── LandingPage.jsx  # strona główna (SEO, public)
│       ├── AuthPage.jsx     # logowanie / rejestracja / reset
│       ├── PublicBooking.jsx# /zapisy — lista zajęć bez logowania
│       ├── ClientDashboard.jsx  # panel klienta
│       └── AdminDashboard.jsx   # panel admina (kalendarz, klienci, finanse)
├── api/                     # Vercel Serverless Functions (Node.js)
│   ├── contact.js           # formularz kontaktowy
│   ├── create-user.js       # tworzenie konta przez admina
│   ├── send-sms.js          # proxy SMS (ukrywa token)
│   ├── remind-classes.js    # Vercel Cron: przypomnienia SMS dzień przed
│   ├── push-subscribe.js    # zapis subskrypcji Web Push
│   ├── push-send.js         # wysyłka push do userIds
│   ├── p24-create.js        # Przelewy24: rejestracja transakcji
│   └── p24-notify.js        # Przelewy24: webhook po płatności
└── public/
    └── sw.js                # Service Worker (Web Push)
```

---

## Baza danych (Supabase / PostgreSQL)

```
profiles        — użytkownicy (role: client | admin)
classes         — zajęcia (nazwa, termin, miejsca, cena, seria)
bookings        — rezerwacje (class_id, user_id, metoda płatności)
waitlist        — kolejka oczekujących
tokens          — karnety (wejścia per miesiąc)
token_history   — log operacji na wejściach
notifications   — powiadomienia in-app
class_ratings   — oceny zajęć (1–5)
class_messages  — wiadomości admina do uczestników
class_templates — szablony zajęć (reużywalne)
```

**Bezpieczeństwo:** Row Level Security (RLS) na każdej tabeli — klient widzi tylko swoje dane. Admin ma pełny dostęp przez `profiles.role = 'admin'`.

**Triggery PostgreSQL:**
- `notify_on_booking` — powiadomienie przy zapisie
- `notify_on_cancel` — powiadomienie przy wypisaniu

---

## Routing

```
/          → LandingPage (zawsze public)
/zapisy    → PublicBooking (public, bez auth)
/          → po zalogowaniu: ClientDashboard lub AdminDashboard
             (zależnie od profiles.role)
```

---

## Zmienne środowiskowe (Vercel)

```bash
# Supabase
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # tylko serverless (admin API)

# Email
GMAIL_USER
GMAIL_PASS

# SMS
SMSAPI_TOKEN

# Web Push
VITE_VAPID_PUBLIC_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY

# Przelewy24
P24_MERCHANT_ID
P24_POS_ID
P24_CRC_KEY
P24_API_KEY
P24_SANDBOX
VITE_APP_URL
```

---

## Decyzje architektoniczne

**Dlaczego nie Next.js?**  
Vite + React SPA jest prostszy w utrzymaniu dla tej skali. SSR nie jest potrzebny — aplikacja wymaga auth, nie indeksowania przez Google (poza landing page).

**Dlaczego Supabase zamiast własnego backendu?**  
Zero ops — auth, baza, RLS, storage w jednym. Przy tej skali (jedno studio, <1000 userów) koszt = 0 zł/miesiąc.

**Dlaczego serverless functions zamiast osobnego API?**  
Vercel Functions są wystarczające do ukrycia tokenów (SMS, P24) i zadań cron. Brak potrzeby osobnego serwera Express/FastAPI.

**Dlaczego CSS custom properties zamiast Tailwind/MUI?**  
Pełna kontrola nad design systemem. Dark mode, branding klienta (zmiana tokenów) — jedna zmienna w CSS i cały wygląd się zmienia.

---

## Skalowalność — drogi rozwoju

### Dziś: single-tenant
Jedna instancja = jedno studio. Nowy klient = nowe Vercel deployment + nowy Supabase projekt.
- **Pro:** izolacja danych, zero ryzyka cross-tenant
- **Con:** ręczny onboarding, brak wspólnego panelu

### Następny krok: multi-tenant (kolumna `studio_id`)
Dodanie `studio_id` do wszystkich tabel + tabela `studios`. Jedna instancja obsługuje wielu klientów. Subdomeny przez Vercel wildcard (`*.studiova.app`).

### Wariant premium: własna domena
Klient podaje swoją domenę → rekord CNAME w jego DNS → Vercel custom domain API → automatyczne SSL.

---

## Koszt infrastruktury (obecny)

| Usługa | Plan | Koszt |
|---|---|---|
| Vercel | Hobby (1 projekt) | 0 zł |
| Supabase | Free tier | 0 zł |
| Gmail SMTP | Standard | 0 zł |
| SMSAPI | Pay-as-you-go | ~0.09 zł/SMS |
| Przelewy24 | Pay-as-you-go | ~1.5% transakcji |

**Łączny koszt stały: 0 zł/miesiąc** (do ~50k requestów/miesiąc i 500MB DB).
