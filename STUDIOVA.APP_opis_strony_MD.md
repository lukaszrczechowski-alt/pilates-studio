# STUDIOVA — Opis strony landing page

> Dokument opisujący strukturę, zawartość i technologię strony marketingowej produktu STUDIOVA.
> Plik służy jako template/baza do dalszego rozwijania aplikacji.

---

## 1. STACK TECHNOLOGICZNY

| Warstwa | Technologia |
|--------|------------|
| HTML | HTML5 (semantyczny, bez frameworka) |
| CSS | Czyste CSS3 + zmienne CSS (bez Tailwinda, bez SCSS) |
| JavaScript | Vanilla JS (bez bibliotek, bez bundlera) |
| Czcionki | Google Fonts CDN — Cormorant Garamond + DM Sans |
| Hosting | Vercel (`studiova.app`) |
| VCS | Git |

**Brak package.json, brak node_modules, brak buildu.**

---

## 2. PLIKI PROJEKTU

```
/STUDIOVA/
├── index.html                  (~40 KB) — cała strona
├── styles.css                  (~35 KB) — kompletne style
├── script.js                   (~6 KB)  — interaktywność
├── logo.png                    (~47 KB) — logotyp
├── ico.png                     (~17 KB) — favicon
├── LANDING_PAGE_BRIEF.md       (~17 KB) — brief produktowy
├── STUDIOVA.APP_opis_strony_MD.md      — ten plik
├── .gitignore
├── .vercel/project.json        — konfiguracja Vercel
└── .claude/settings.local.json — uprawnienia Claude Code
```

---

## 3. STRUKTURA STRONY (SEKCJE)

Strona to **single-page** z nawigacją przez anchory. Wszystko na jednym scrollu.

| # | ID sekcji | Nazwa | Opis zawartości |
|---|-----------|-------|-----------------|
| 1 | `#hero` | Hero | Główny nagłówek, claim, CTA, mockup panelu admina |
| 2 | `#problem` | Problem | 3 karty opisujące bóle klienta |
| 3 | `#for-who` | Dla kogo | 6 kart — persony: trener, pilates, sauna, masaż, taniec, studio |
| 4 | `#features` | Panel admina | Lista 6 funkcji, mockup przeglądarki z panelem |
| 5 | `#client-panel` | Panel klienta | Mockup telefonu z widokiem rezerwacji |
| 6 | `#automations` | Automatyzacje | 6 kart — automatyczne powiadomienia, SMS, przypomnienia |
| 7 | `#how-it-works` | Jak to działa | 3 kroki wdrożenia (timeline) |
| 8 | `#comparison` | Porównanie | Tabela: STUDIOVA vs 3 konkurenci |
| 9 | `#pricing` | Cennik | 1 karta: 500 zł wdrożenie + 49 zł/miesiąc |
| 10 | `#faq` | FAQ | 8 rozwijanych pytań i odpowiedzi |
| 11 | `#contact` | Kontakt / CTA | Sekcja końcowa z przyciskami kontaktowymi |

---

## 4. KOMPONENTY UI

### Nawigacja
- Sticky header z blur na scroll
- Desktop: linki anchory + przycisk CTA
- Mobile: hamburger menu (toggle)
- Podświetlanie aktywnej sekcji przy scrollu

### Floating CTA
- Stały przycisk dolny-prawy
- Pojawia się po wyjściu z sekcji hero
- Znika przy sekcji #contact

### Scroll Progress Bar
- Poziomy pasek na górze strony
- Pokazuje postęp czytania

### Mockup Panelu Admina (`#features`)
- Wygląd Chrome browser (zakładki, address bar)
- Sidebar z nawigacją
- Widok kalendarza z zajęciami
- Karta statystyk (przychody, uczestnicy)
- Modal listy uczestników z metodami płatności

### Mockup Telefonu (`#client-panel`)
- iPhone frame z notchem
- Widok listy zajęć i rezerwacji

### Karty automatyzacji (`#automations`)
- 6 kart z ikoną emoji, tytułem i opisem
- Animacja fade-up przy wejściu w viewport

### Tabela porównawcza (`#comparison`)
- STUDIOVA vs Booksy, Mindbody, Arkus
- Checkmarki (✓) i krzyżyki (✗) dla każdej funkcji

### FAQ Accordion (`#faq`)
- 8 pytań
- Tylko jedno otwarte naraz
- Animacja rozwijania

### Footer
- Logo + tagline
- Linki do sekcji
- Dane kontaktowe (email + telefon)
- Copyright

---

## 5. DANE KONTAKTOWE (HARDCODED)

```
Email:    lukasz.r.czechowski@gmail.com
Telefon:  508 510 642
```

---

## 6. PALETA KOLORÓW (CSS VARIABLES)

```css
--cream:       #F7F3EE   /* tło główne */
--warm-white:  #FDFAF6   /* tła kart */
--sage:        #8A9E85   /* kolor główny CTA, akcenty */
--sage-light:  #B8CBAF   /* drugorzędne akcenty */
--sage-dark:   #5C7A56   /* ciemny akcent, nawigacja */
--clay:        #C4917A   /* kolor drugorzędny, badge'y */
--clay-light:  #EDD9CE   /* jasny drugorzędny */
--charcoal:    #2C2C2C   /* tekst główny */
--mid:         #6B6B6B   /* tekst drugorzędny */
--light:       #9B9B9B   /* tekst trzeciorzędny */
--border:      #E8E0D8   /* obramowania */
```

**Klimat:** ciepły, premium, spa/wellness

---

## 7. TYPOGRAFIA

| Użycie | Font | Grubości |
|--------|------|---------|
| Nagłówki, luksusowe elementy | Cormorant Garamond | 400, 500, 600 |
| Tekst ciągły, UI | DM Sans | 400, 500, 600 |

---

## 8. RESPONSYWNOŚĆ

Breakpointy w styles.css:
- **1024px** — tablet/laptop
- **768px** — tablet pionowy
- **480px** — mobile

Podejście: CSS Grid + Flexbox. Brak preprocessora.

---

## 9. JAVASCRIPT — FUNKCJE (script.js)

| Funkcja | Trigger | Co robi |
|---------|---------|---------|
| Scroll Progress Bar | `scroll` | Aktualizuje pasek postępu na górze |
| Header Shadow | `scroll` | Dodaje cień po 12px scrollu |
| Floating CTA | `scroll` | Pokazuje/ukrywa stały przycisk CTA |
| Hamburger Menu | `click` | Otwiera/zamyka mobile nav |
| Fade-Up Animations | Intersection Observer | Animuje elementy wchodzące w viewport |
| Counter Animation | Intersection Observer | Animuje liczniki (`data-count` attr) |
| FAQ Accordion | `click` | Rozwijanie/zwijanie pytań |
| Smooth Scroll | `click` na `a[href^="#"]` | Płynne przewijanie z offsetem headera |
| Active Nav Highlight | `scroll` | Podświetla aktywną sekcję w nav |

---

## 10. WDROŻENIE

- **Platforma:** Vercel
- **Project ID:** `prj_016OSMzv8ZLX0lKJlXzaXS74wLsz`
- **Org ID:** `team_L7oXdrVLgUNAoWmlP3sVVDm1`
- **Nazwa projektu:** `studiova.app`
- **Deploy:** push do gita → auto-deploy przez Vercel

---

## 11. CO OPISUJE STRONA (PRODUKT)

Landing page reklamuje **SaaS-owy system rezerwacji dla branży wellness/fitness** — nie zawiera samej aplikacji.

Funkcje opisywanego produktu STUDIOVA (z innego repo):
- Panel admina (kalendarz, grafik, klienci, finanse)
- Panel klienta (rezerwacje online, anulowanie, historia)
- Automatyczne SMS i e-mail powiadomienia (SMSAPI)
- Płatności online (Przelewy24 / P24)
- Obsługa wielu lokalizacji
- Raportowanie finansowe

**Model cenowy (z landing page):**
- 500 zł — jednorazowe wdrożenie
- 49 zł/miesiąc — abonament

---

## 12. POTENCJALNE OBSZARY DO ROZBUDOWY

| Obszar | Propozycja |
|--------|-----------|
| Formularz kontaktowy | Formspree / Netlify Forms zamiast mailto |
| Analytics | Google Analytics / Plausible / Vercel Analytics |
| SEO | Open Graph, meta description, strukturyzowane dane |
| Performance | Lazy-load obrazów, preload fontów |
| Testy A/B | Różne warianty CTA / cennika |
| Animacje | Bardziej rozbudowane hover effects na kartach |
| Dark mode | Dodatkowa paleta dla trybu ciemnego |
| Blog / Aktualności | Dodatkowa podstrona lub sekcja |
| Chatbot / Widget | Live chat (Crisp, Tawk.to) |
| Video | Demo wideo produktu w sekcji hero lub features |

---

*Wygenerowano: 2026-04-17*
