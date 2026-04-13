# 🧘 Pilates Studio — Instrukcja wdrożenia

## Co dostajesz

Pełna webaplikacja z:
- **Panelem klienta**: przeglądanie zajęć, zapis / wypisanie, lista rezerwacji
- **Panelem admina (Pauliny)**: tworzenie zajęć, lista uczestników, historia, widok klientów
- **Autoryzacją**: rejestracja email + hasło, bezpieczna baza danych

**Koszt: 0 zł** (Supabase free tier + Vercel free tier)

---

## KROK 1 — Supabase (baza danych + auth)

1. Wejdź na **https://supabase.com** i kliknij „Start your project"
2. Zaloguj się przez GitHub lub email
3. Kliknij **„New project"**, wypełnij:
   - Name: `pilates-studio`
   - Database Password: (zapamiętaj to hasło!)
   - Region: `Central EU (Frankfurt)`
4. Poczekaj ~2 minuty aż projekt się uruchomi

### Utwórz bazę danych

5. W lewym menu kliknij **„SQL Editor"**
6. Kliknij **„New query"**
7. Wklej całą zawartość pliku `supabase_schema.sql`
8. Kliknij **„Run"** (lub Ctrl+Enter)
9. Powinieneś zobaczyć „Success. No rows returned"

### Pobierz klucze API

10. W lewym menu kliknij **„Project Settings"** (ikona koła zębatego)
11. Kliknij **„API"**
12. Skopiuj:
    - **Project URL** → zapisz jako `SUPABASE_URL`
    - **anon public** → zapisz jako `SUPABASE_ANON_KEY`

---

## KROK 2 — Uruchom lokalnie (test)

```bash
# W folderze projektu:
cp .env.example .env.local

# Edytuj .env.local i wklej swoje klucze:
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhb...

npm install
npm run dev
```

Otwórz http://localhost:5173 — aplikacja powinna działać!

---

## KROK 3 — Nadaj Paulinie rolę admina

1. Paulina rejestruje się przez aplikację (normalnie, jak klient)
2. Wejdź do Supabase → **„SQL Editor"**
3. Wklej i uruchom:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email-pauliny@example.com';
```
(zamień na prawdziwy email Pauliny)

4. Od teraz po zalogowaniu zobaczy panel admina

---

## KROK 4 — Wdrożenie na Vercel (publiczny link)

1. Wejdź na **https://vercel.com** i zaloguj się przez GitHub
2. Wgraj kod projektu na GitHub:
   ```bash
   git init
   git add .
   git commit -m "Pilates Studio"
   git branch -M main
   git remote add origin https://github.com/TWOJA-NAZWA/pilates-studio.git
   git push -u origin main
   ```
3. W Vercel kliknij **„Add New Project"**
4. Wybierz swoje repozytorium
5. W sekcji **„Environment Variables"** dodaj:
   - `VITE_SUPABASE_URL` = twój URL
   - `VITE_SUPABASE_ANON_KEY` = twój klucz
6. Kliknij **„Deploy"**
7. Po ~1 minucie dostaniesz link: `pilates-studio.vercel.app`

---

## Gotowe! Co dalej?

- **Link dla klientów**: `https://pilates-studio.vercel.app`
- Klienci sami się rejestrują i zapisują na zajęcia
- Paulina loguje się tym samym linkiem i widzi panel admina

### Opcjonalnie — własna domena
Jeśli Paulina ma domenę (np. `paulinapilates.pl`), można ją podpiąć w Vercel za darmo w ustawieniach projektu → „Domains".

---

## Struktura plików

```
src/
  App.jsx              # Główny komponent, routing
  App.css              # Style globalne
  supabase.js          # Klient Supabase
  pages/
    AuthPage.jsx        # Logowanie / rejestracja
    ClientDashboard.jsx # Panel klienta
    AdminDashboard.jsx  # Panel admina
supabase_schema.sql    # SQL do wklejenia w Supabase
```
