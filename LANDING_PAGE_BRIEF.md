# Brief: Landing Page dla produktu STUDIO

> Dokument dla Claude — kompletna instrukcja do zbudowania landing page produktu bez dostępu do kodu aplikacji.

---

## 1. Czym jest STUDIO?

**STUDIO** to gotowy system rezerwacji online dla jednoosobowych trenerek (pilates, joga, fitness) i małych studiów. Właścicielka dostaje gotową aplikację webową: klienci zapisują się sami przez internet, ona zarządza grafikiem z telefonu. Żadnych WhatsAppów, żadnych arkuszy Excel.

**Model biznesowy:** jednorazowa opłata wdrożeniowa + niski miesięczny abonament. Klient dostaje własną, gotową instancję systemu.

**Język docelowy:** polski. Odbiorcy: polskie trenerki pilates/jogi/fitness, fryzjerzy, kosmetyczki — jednoosobowe działalności.

---

## 2. Tożsamość wizualna (WAŻNE — trzymaj się tego)

### Paleta kolorów
```
--cream:      #F7F3EE   → tło główne, sekcje jasne
--warm-white: #FDFAF6   → tło kart, panele
--sage:       #8A9E85   → GŁÓWNY akcent (zielony szałwiowy) — przyciski CTA, highlights
--sage-light: #B8CBAF   → tła akcentowe, hover states
--sage-dark:  #5C7A56   → tekst na sage tle, ikony
--clay:       #C4917A   → DRUGORZĘDNY akcent (terakota/glina) — tagi, badges, wyróżnienia
--charcoal:   #2C2C2C   → tekst główny
--mid:        #6B6B6B   → tekst pomocniczy, opisy
--border:     #E8E0D8   → obramowania, separatory
```

### Fonty (załaduj z Google Fonts)
- **Cormorant Garamond** (weights: 400, 500, 600) — wszystkie nagłówki H1–H4, duże quote'y, elementy dekoracyjne. Daje elegancki, "luxury wellness" feel.
- **DM Sans** (weights: 400, 500, 600) — body text, przyciski, labels, UI. Nowoczesny i czytelny.

### Styl ogólny
- **Elegancki, ciepły, spa-like** — nie korporacyjny, nie startupowy
- Dużo białej przestrzeni (cream background)
- Zaokrąglone rogi (8–16px)
- Cienie bardzo subtelne (`box-shadow: 0 2px 12px rgba(0,0,0,0.06)`)
- Żadnych flashy animacji — wszystko spokojne, `transition: all 0.2s ease`
- Zdjęcia/ilustracje: ciepłe tonacje, kobiety ćwiczące pilates/jogę (możesz użyć Unsplash placeholderów)

---

## 3. Struktura sekcji landing page

### Sekcja 1 — HERO

**Nagłówek (Cormorant Garamond, ~56–72px, charcoal):**
> Twoje studio.<br/>Twoje zasady.<br/>Bez chaosu.

**Podtytuł (DM Sans, 18–20px, mid):**
> Profesjonalny system rezerwacji dla trenerek i małych studiów. Klientki zapisują się same — Ty skupiasz się na prowadzeniu zajęć.

**CTA:**
- Przycisk główny (sage, biały tekst): `Umów bezpłatną prezentację`
- Link drugorzędny (mid, underline): `Zobacz demo →`

**Wizual po prawej / w tle:**
Mock ekranu aplikacji — możesz zrobić device mockup (laptop lub telefon) z interfejsem aplikacji. Opisuję jak wygląda ekran poniżej w sekcji "Opisy ekranów".

**Pod hero — pasek z logikami (3 ikony inline):**
- ✓ Gotowe w 48h
- ✓ Bez umowy na czas nieokreślony  
- ✓ Pełne wsparcie przy wdrożeniu

---

### Sekcja 2 — PROBLEM (ciemniejsze tło, np. #2C2C2C lub gradient)

**Nagłówek:**
> Rozpoznajesz to?

**3 karty z bólem (układ 3 kolumny na desktop, 1 na mobile):**

Karta 1 — ikona 📱
> **Rezerwacje przez WhatsApp**
> Klientki piszą o różnych porach. Musisz sprawdzać czy miejsce jest wolne, odpisywać ręcznie, pamiętać kto się zapisał.

Karta 2 — ikona 📊  
> **Grafik w Excelu lub zeszycie**
> Trudno zobaczyć wolne miejsca, łatwo o pomyłkę. Nie ma jak szybko sprawdzić czy zajęcia się zapełniły.

Karta 3 — ikona 😰
> **Przypomnienia wysyłane ręcznie**
> Dzień przed zajęciami rozsyłasz wiadomości jedna po drugiej. Zajmuje to czas, który mogłabyś poświęcić na siebie.

**Pod kartami, duże i wyróżnione (sage lub clay kolor):**
> STUDIO rozwiązuje to wszystko automatycznie.

---

### Sekcja 3 — PANEL ADMINISTRATORA (cream tło)

**Label nad nagłówkiem (clay kolor, DM Sans caps, mały):**
> DLA TRENERKI

**Nagłówek (Cormorant Garamond):**
> Pełna kontrola w jednym miejscu

**Podtytuł:**
> Zarządzaj grafikiem, klientami i finansami z dowolnego urządzenia.

**Układ: 2 kolumny — lista ficzerów + mockup ekranu**

Lista ficzerów (każdy z ikoną):

- 📅 **Kalendarz zajęć** — widok tygodniowy i dzienny. Dodawanie, edycja, odwoływanie zajęć jednym kliknięciem.
- 👥 **Lista uczestników** — kto jest zapisany, metoda płatności, historia rezerwacji.
- 🔁 **Zajęcia cykliczne** — utwórz serię zajęć na cały miesiąc jedną akcją.
- 🎫 **Karnety / wejścia** — przydzielaj wejścia klientkom, system automatycznie je odlicza przy każdym zapisie.
- 💰 **Finanse** — zestawienie przychodów, koszty sali, eksport CSV do księgowości.
- 📊 **Raporty i oceny** — podsumowanie zajęć, średnia ocen, komentarze klientek.
- 👤 **Kartoteka klientek** — notatki prywatne, data urodzin, numer telefonu, historia rezerwacji.
- 💬 **Wiadomości do uczestników** — wyślij komunikat do wszystkich zapisanych na dane zajęcia.

**Mockup ekranu admina — opisuję jak wygląda:**
- Sidebar po lewej (cream/warm-white): logo "Pilates" z podtytułem "Studio by Paulina", nawigacja pionowa z ikonami (Zajęcia, Klienci, Finanse, Szablony, Powiadomienia), awatar użytkownika na dole
- Główna treść: widok kalendarza z siatką dni tygodnia, karty zajęć w komórkach (zielone = są zapisy, szare = wolne), pasek z informacjami o zajęciach
- Styl: czysty, dużo białej przestrzeni, kolory cream/sage

---

### Sekcja 4 — PANEL KLIENTKI (warm-white lub jasnoszare tło)

**Label nad nagłówkiem (sage kolor):**
> DLA KLIENTEK

**Nagłówek:**
> Profesjonalne doświadczenie rezerwacji

**Podtytuł:**
> Klientki zyskują własny panel — zapisy, historia, powiadomienia. Wszystko w przeglądarce, bez instalowania aplikacji.

**Układ: mockup telefonu/tabletu po lewej + lista po prawej**

Lista ficzerów:

- 🗓 **Widok kalendarza** — klientka widzi wszystkie zajęcia, wolne miejsca, może filtrować.
- ✦ **Szybki zapis** — wybiera zajęcia, metodę płatności (gotówka / karnet / online), potwierdza. Całość w 3 kliknięciach.
- 💳 **Płatności online** — integracja z Przelewy24: BLIK, karta, przelew. Bez wychodzenia z aplikacji.
- 📋 **Historia rezerwacji** — wszystkie minione i nadchodzące zajęcia w jednym miejscu.
- ⭐ **Oceny zajęć** — po zajęciach klientka może wystawić ocenę 1–5 + komentarz.
- 🔔 **Powiadomienia push** — na telefon, bez instalowania app. Działa jak natywna aplikacja.
- 🌙 **Dark mode** — automatycznie dopasowuje się do preferencji systemu.

---

### Sekcja 5 — AUTOMATYZACJE (sage ciemniejsze tło lub gradient cream → sage-light)

**Nagłówek:**
> Pracuje za Ciebie, gdy Ty odpoczywasz

**Podtytuł:**
> STUDIO automatycznie wysyła komunikaty w kluczowych momentach. Nie musisz o niczym pamiętać.

**Siatka 2×2 lub 4 w rzędzie — karty automatyzacji:**

Karta 1 — ⏰
> **Przypomnienia SMS dzień przed**
> Każda zapisana klientka dostaje SMS z przypomnieniem o zajęciach następnego dnia. Zero nieobecności z powodu zapomnienia.

Karta 2 — ❌
> **Powiadomienie o odwołaniu**  
> Gdy odwołasz zajęcia — SMS i push notification leci do wszystkich zapisanych natychmiastowo.

Karta 3 — 📋
> **Awans z listy oczekujących**
> Gdy ktoś się wypisze — kolejna osoba na liście dostaje SMS i automatycznie otrzymuje miejsce.

Karta 4 — 🎂
> **Życzenia urodzinowe**
> Codziennie rano system sprawdza urodziny klientek i wysyła spersonalizowaną wiadomość. Buduje relację bez wysiłku.

Karta 5 — ✉️
> **Email potwierdzający zapis**
> Po każdym zapisie klientka dostaje email z datą, godziną i miejscem zajęć.

Karta 6 — 👋
> **Powitalny email po rejestracji**
> Nowa klientka od razu dostaje ciepłą wiadomość z zaproszeniem do pierwszych zajęć.

---

### Sekcja 6 — JAK TO DZIAŁA (cream tło)

**Nagłówek:**
> Wdrożenie w 3 krokach

**Timeline poziomy (desktop) / pionowy (mobile) — 3 kroki:**

Krok 1 — 📞
> **Konsultacja i setup (dzień 1)**
> Umawiamy się na 30-minutową rozmowę. Konfiguruję system pod Twoje studio: nazwa, kolory, harmonogram, cennik.

Krok 2 — 🔗
> **Dostajesz gotowy link (dzień 2)**
> Twój panel admina i link dla klientek są gotowe. Możesz od razu zacząć dodawać zajęcia i zapraszać klientki.

Krok 3 — 🚀
> **Jesteś live (dzień 2–3)**  
> Klientki rejestrują się i zapisują samodzielnie. Ty zyskujesz czas i profesjonalny wizerunek.

---

### Sekcja 7 — PORÓWNANIE (opcjonalna, warm-white tło)

**Nagłówek:**
> STUDIO vs inne rozwiązania

Tabela porównawcza (5 kolumn: cecha | STUDIO | Booksy/Fresha | Mindbody | Excel+WhatsApp):

| | STUDIO | Booksy/Fresha | Mindbody | Excel+WhatsApp |
|---|---|---|---|---|
| Własna marka, własny adres | ✓ | ✗ (jesteś na ich platformie) | ✗ | ✗ |
| Brak prowizji od rezerwacji | ✓ | ✗ | ✗ | ✓ |
| SMS + Push + Email automatycznie | ✓ | częściowo | ✓ | ✗ |
| Panel klienta bez instalacji app | ✓ | ✓ | ✓ | ✗ |
| Cena (mały studio) | niski abonament | % od rezerwacji | drogi | free |
| Pełne wsparcie po polsku | ✓ | ograniczone | ✗ | — |
| Konfiguracja pod Twoje potrzeby | ✓ | ✗ | ✗ | ✓ |

Podkreśl kolumnę STUDIO (sage tło nagłówka).

---

### Sekcja 8 — CENNIK (cream lub bardzo jasne sage tło)

**Nagłówek:**
> Prosty cennik, bez niespodzianek

**2 karty cenowe:**

**Karta 1 — Wdrożenie (jednorazowo)**
- Duża liczba ceny (Cormorant Garamond): `[CENA] zł`
- Podtytuł: jednorazowo
- Co obejmuje:
  - Pełna konfiguracja systemu
  - Własna domena lub subdomena
  - Migracja danych (jeśli potrzebna)
  - Szkolenie (30 min online)
  - Integracja SMS i email

**Karta 2 — Abonament (miesięcznie)** — wyróżniona, sage border lub sage background
- Badge: `Najpopularniejszy`
- Duża liczba ceny: `[CENA] zł / miesiąc`
- Co obejmuje:
  - Hosting i utrzymanie
  - Aktualizacje i nowe funkcje
  - Wsparcie techniczne
  - Kopie zapasowe
  - Bez limitu klientek i zajęć

**Pod kartami drobnym tekstem:**
> Cena nie zawiera kosztów SMS (ok. 0,09 zł/SMS, płatne bezpośrednio do SMSAPI) ani bramki płatności P24 (prowizja wg cennika Przelewy24).

---

### Sekcja 9 — FAQ

**Nagłówek:**
> Najczęstsze pytania

Lista akordeonów (lub widoczne od razu na desktop):

**Q: Czy klientki muszą instalować aplikację?**
> Nie. STUDIO to aplikacja webowa — działa w przeglądarce na telefonie i komputerze. Klientki mogą dodać ją do ekranu głównego jak natywną aplikację (PWA).

**Q: Czy mogę przetestować przed zakupem?**
> Tak. Umów bezpłatną prezentację — pokażę Ci działające demo i odpowiem na wszystkie pytania. Możesz też przez tydzień korzystać z systemu testowo.

**Q: Co się stanie jeśli chcę zrezygnować?**
> Daję dostęp do pełnego eksportu danych (CSV). Nie ma okresu wypowiedzenia — płacisz miesięcznie i możesz zrezygnować kiedy chcesz.

**Q: Czy system działa na telefonie?**
> Tak, jest w pełni responsywny. Zarówno panel trenerki jak i panel klientek wyglądają i działają świetnie na telefonach.

**Q: Czy mogę dostosować nazwy, kolory, logo?**
> Tak. Przy wdrożeniu konfiguruję system pod Twoją markę: nazwa studia, adres strony, emaile wysyłane w Twoim imieniu.

**Q: Jak działają płatności online?**
> Przez Przelewy24 (BLIK, karta, przelew). Klientka płaci przy zapisie. Pieniądze trafiają bezpośrednio na Twoje konto — ja nie pobieram prowizji od transakcji.

**Q: Czy działasz tylko z pilates?**
> Nie. System sprawdzi się dla każdego małego studia ze stałym harmonogramem: joga, taniec, fitness, fizjoterapia, a nawet fryzjer czy kosmetyczka.

---

### Sekcja 10 — CTA (sage ciemne tło lub gradient)

**Nagłówek (Cormorant Garamond, biały lub cream):**
> Gotowa żeby przestać zarządzać WhatsAppem?

**Podtytuł (DM Sans, jasny):**
> Umów bezpłatną prezentację. Pokażę Ci jak STUDIO może wyglądać z Twoją marką.

**2 przyciski:**
- Główny (biały lub clay): `Umów prezentację`
- Drugorzędny (outline biały): `Napisz na [email]`

---

### FOOTER

- Logo / nazwa
- `[email kontaktowy]`
- `[telefon — opcjonalnie]`
- Prawa autorskie

---

## 4. Opisy ekranów aplikacji (do mockupów)

### Ekran A — Panel admina, zakładka Zajęcia
- Sidebar po lewej (szerokość ~240px, tło warm-white): napis "Pilates" (Cormorant Garamond, duży), "Studio by Paulina" (mały), nawigacja pionowa z ikonami i tekstem, u dołu awatar z inicjałami
- Główna treść: tytuł "Zajęcia", przyciski "📅 Dzienny" / "Tydzień", siatka kalendarza tygodniowego
- Karty zajęć w siatce: zaokrąglone, kolor sage-light gdy zapełnione, tytuł zajęć, godzina, "X/Y miejsc"
- Na dole: button "+ Nowe zajęcia" (sage, biały tekst)

### Ekran B — Panel admina, lista uczestników
- Modal na środku (cień, białe tło, border-radius 12px)
- Nagłówek modalu: "Uczestnicy — Pilates Fundamentals"
- Lista klientek: awatar z inicjałami (sage kółko), imię nazwisko, badge płatności (💵 Gotówka / 🎫 Karnet)
- Opcja wysłania wiadomości do wszystkich

### Ekran C — Panel klientki, kalendarz
- Sidebar analogiczny do admina ale z opcjami: Zajęcia, Moje rezerwacje, Powiadomienia, Moje konto
- Siatka miesięczna kalendarza
- Kliknięty dzień: karty zajęć z czasem, nazwą, "X/Y miejsc", status (wolne / zapisano / brak miejsc)
- Karta "Zapisano" ma zielone obramowanie, badge "Zapisano · 💵"

### Ekran D — Modal zapisu
- Tytuł: "Wybierz sposób płatności"
- Opis zajęć: bold nazwa, data, godzina, cena
- 3 opcje do wyboru (karty klikalne):
  - 💵 Gotówka na miejscu
  - 🎫 Wejście z karnetu (z info "Masz X wejść na [miesiąc]")
  - 💳 Płatność online — karta, BLIK (tylko gdy cena > 0)
- Przycisk "Zapisz się →" (sage, pełna szerokość)

### Ekran E — Panel klientki, Moje konto
- Sekcja telefonu z polem input
- Sekcja daty urodzin z datepicker
- Toggle powiadomień push
- Dark mode toggle

---

## 5. Wskazówki techniczne dla landing page

### Stack (sugestia)
- **Czysty HTML + CSS + vanilla JS** — najszybszy do wdrożenia, zero zależności, łatwy hosting
- Alternatywnie: **Astro** (statyczny SSG, świetna wydajność)
- **Nie używaj React** — to landing page, nie potrzebuje SPA

### Hosting
- Vercel (darmowy plan wystarczy dla statycznej strony)
- Netlify (alternatywnie)
- Oddzielna domena od aplikacji, np. `getstudio.pl` lub `studio-app.pl`

### Responsywność
- Mobile-first
- Breakpoint główny: 768px
- Na mobile: sekcje porównania i ceny jako karty scrollowalne poziomo

### Animacje
- Fade-in przy scroll (Intersection Observer API, bez bibliotek)
- Hover na kartach: `transform: translateY(-2px)` + lekki cień
- Żadnych autoplay wideo, żadnych efektów parallax

### Dostępność
- `alt` na wszystkich obrazkach
- Wyraźny kontrast tekstu (charcoal na cream jest ok)
- Przyciski CTA muszą mieć `:focus-visible` outline

### Formularze CTA
- Jeśli chcesz obsługiwać formularz kontaktowy: Formspree (free tier), Netlify Forms lub po prostu `mailto:` link
- Nie potrzeba backendu

---

## 6. Ton komunikacji

- **Ciepły, przyjazny, kobiecy** — mówisz do trenerki, nie do korporacji
- **Konkretny** — nie "zwiększ efektywność", tylko "klientki zapisują się same o każdej porze"
- **Pewny siebie** — nie "spróbuj", tylko "umów prezentację"
- **Polski** — żadnych anglicyzmów tam gdzie nie trzeba (nie "dashboard", tylko "panel")
- **Bez hype'u** — żadnych "REWOLUCJA!", żadnych "GAME CHANGER"

---

## 7. Assets do uzupełnienia przez właściciela

Miejsca z placeholderami `[...]` które trzeba uzupełnić:
- `[CENA_WDROZENIE]` — jednorazowa opłata za wdrożenie
- `[CENA_ABONAMENT]` — miesięczny abonament
- `[EMAIL_KONTAKTOWY]` — adres email do kontaktu
- `[TELEFON]` — opcjonalny numer telefonu
- `[LINK_DO_DEMO]` — URL działającego dema
- `[LINK_DO_KALENDARZA]` — Calendly lub inny link do umówienia spotkania
- `[NAZWA_WLASCICIELA]` — imię osoby sprzedającej (do podpisu w stopce)

---

## 8. SEO (podstawy)

```html
<title>STUDIO — System rezerwacji dla trenerek pilates i jogi</title>
<meta name="description" content="Profesjonalny system rezerwacji online dla małych studiów. Klientki zapisują się same, automatyczne SMS-y i emaile, panel admina i klientki. Wdrożenie w 48h.">
<meta property="og:title" content="STUDIO — koniec z rezerwacjami przez WhatsApp">
<meta property="og:description" content="System rezerwacji dla trenerek. Klientki zapisują się online, Ty zarządzasz grafikiem z telefonu.">
```

Frazy kluczowe do użycia naturalnie w treści:
- "system rezerwacji dla pilates"
- "aplikacja do zapisów na zajęcia"
- "panel rezerwacji online dla studia"
- "oprogramowanie dla trenerki"

---

*Brief wygenerowany: 2026-04-16. Wersja produktu: STUDIO v1.0*
