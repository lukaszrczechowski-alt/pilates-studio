import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES_PL = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function PbIcon({ name, size = 16, color = "currentColor" }) {
  const s = { width: size, height: size, display: "inline-block", flexShrink: 0 };
  const p = { fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    calendar:  <svg viewBox="0 0 24 24" style={s}><rect x="3" y="4" width="18" height="18" rx="2" {...p}/><line x1="16" y1="2" x2="16" y2="6" {...p}/><line x1="8" y1="2" x2="8" y2="6" {...p}/><line x1="3" y1="10" x2="21" y2="10" {...p}/></svg>,
    clock:     <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...p}/><polyline points="12 7 12 12 15.5 14" {...p}/></svg>,
    mapPin:    <svg viewBox="0 0 24 24" style={s}><path d="M12 21s-7-6.545-7-11a7 7 0 0 1 14 0c0 4.455-7 11-7 11z" {...p}/><circle cx="12" cy="10" r="2.5" {...p}/></svg>,
    money:     <svg viewBox="0 0 24 24" style={s}><rect x="2" y="6" width="20" height="13" rx="2" {...p}/><line x1="2" y1="10" x2="22" y2="10" {...p}/><line x1="6" y1="15" x2="9" y2="15" {...p}/></svg>,
    users:     <svg viewBox="0 0 24 24" style={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...p}/><circle cx="9" cy="7" r="4" {...p}/><path d="M23 21v-2a4 4 0 0 0-3-3.87" {...p}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...p}/></svg>,
    user:      <svg viewBox="0 0 24 24" style={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...p}/><circle cx="12" cy="7" r="4" {...p}/></svg>,
    note:      <svg viewBox="0 0 24 24" style={s}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...p}/><polyline points="14 3 14 9 20 9" {...p}/><line x1="8" y1="13" x2="16" y2="13" {...p}/><line x1="8" y1="17" x2="12" y2="17" {...p}/></svg>,
    checkCircle:<svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...p}/><polyline points="9 12 11 14 15 10" {...p}/></svg>,
    leaf:      <svg viewBox="0 0 24 24" style={s}><path d="M2 22c5.333-5.333 8-10 8-14a8 8 0 0 1 12-6.928" {...p}/><path d="M2 22c2.667-8 8-12 14-13" {...p}/></svg>,
    globe:     <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...p}/><path d="M2 12h20" {...p}/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" {...p}/></svg>,
    arrowLeft: <svg viewBox="0 0 24 24" style={s}><line x1="19" y1="12" x2="5" y2="12" {...p}/><polyline points="12 19 5 12 12 5" {...p}/></svg>,
    arrowRight:<svg viewBox="0 0 24 24" style={s}><line x1="5" y1="12" x2="19" y2="12" {...p}/><polyline points="12 5 19 12 12 19" {...p}/></svg>,
    xmark:     <svg viewBox="0 0 24 24" style={s}><line x1="18" y1="6" x2="6" y2="18" {...p}/><line x1="6" y1="6" x2="18" y2="18" {...p}/></svg>,
    noSpots:   <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...p}/><line x1="15" y1="9" x2="9" y2="15" {...p}/><line x1="9" y1="9" x2="15" y2="15" {...p}/></svg>,
  };
  return icons[name] || null;
}

export default function PublicBooking({ studioId }) {
  const { studio } = useStudio();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const b = studio?.branding || {};
  const name = studio?.name || "Studio";
  const letter = name[0] || "S";
  const serviceMode = studio?.features?.service_mode || "classes";
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const isServices = serviceMode === "services";

  const DAY_NAMES = lang === "en" ? DAY_NAMES_EN : DAY_NAMES_PL;
  const MONTH_NAMES = lang === "en" ? MONTH_NAMES_EN : MONTH_NAMES_PL;
  const locale = lang === "en" ? "en-GB" : "pl-PL";

  const sage = b.colors?.sage || "#8A9E85";
  const clay = b.colors?.clay || "#C4917A";
  const cream = b.colors?.cream || "#F7F3EE";

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [formLoadTime] = useState(() => Date.now());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [guestForm, setGuestForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [guestSending, setGuestSending] = useState(false);
  const [guestBooked, setGuestBooked] = useState(false);
  const [guestError, setGuestError] = useState("");

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => {
    setGuestBooked(false);
    setGuestError("");
    setGuestForm({ firstName: "", lastName: "", email: "", phone: "" });
  }, [selectedClass]);

  async function fetchClasses() {
    const now = new Date().toISOString();
    let query = supabase.from("classes")
      .select("*, bookings(id), staff(name, color)")
      .gte("starts_at", now)
      .or("cancelled.is.null,cancelled.eq.false")
      .order("starts_at", { ascending: true });
    if (studioId) query = query.eq("studio_id", studioId);
    const { data } = await query;
    setClasses(data || []);
    setLoading(false);
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  }

  const NUM_WEEKS = 3;
  const periodEnd = new Date(weekStart);
  periodEnd.setDate(periodEnd.getDate() + 7 * NUM_WEEKS);

  const weeks = Array.from({ length: NUM_WEEKS }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + wi * 7 + di);
      return d;
    })
  );

  const periodClasses = classes.filter(c => {
    const d = new Date(c.starts_at);
    return d >= weekStart && d < periodEnd;
  });

  const hasAnyFuture = classes.length > 0;
  const hasThisWeek = periodClasses.length > 0;

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7 * NUM_WEEKS);
    const monday = getMonday(new Date());
    setWeekStart(d < monday ? monday : d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7 * NUM_WEEKS);
    setWeekStart(d);
  }

  const isPrevDisabled = weekStart <= getMonday(new Date());
  const periodEndDay = new Date(periodEnd.getTime() - 1);
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${periodEndDay.getDate()} ${MONTH_NAMES[periodEndDay.getMonth()]} ${periodEnd.getFullYear()}`;

  async function submitGuestBook(e) {
    e.preventDefault();
    setGuestError("");
    setGuestSending(true);
    try {
      const res = await fetch("/api/guest-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          studioId,
          firstName: guestForm.firstName,
          lastName: guestForm.lastName,
          email: guestForm.email,
          phone: guestForm.phone,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setGuestError(json.error || "Błąd rezerwacji."); setGuestSending(false); return; }
      setGuestBooked(true);
    } catch (err) {
      setGuestError("Błąd połączenia. Spróbuj ponownie.");
    }
    setGuestSending(false);
  }

  async function sendContact(e) {
    e.preventDefault();
    if (!contactName.trim() || !contactMsg.trim()) return;
    setContactSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, contact: contactInfo, message: contactMsg, studioId, _hp: honeypot, _t: formLoadTime }),
      });
      const json = await res.json();
      if (!res.ok) { alert((json.error || res.status)); setContactSending(false); return; }
    } catch (err) {
      alert(err.message);
      setContactSending(false);
      return;
    }
    setContactSending(false);
    setContactSent(true);
  }

  const inputStyle = { width: "100%", padding: "0.65rem 0.85rem", border: "1px solid #E8E0D8", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: "0.75rem", color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem" };

  return (
    <div style={{ minHeight: "100vh", background: cream, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        .pb-day-col { flex: 1; min-width: 0; }
        .pb-card:hover { box-shadow: 0 4px 16px rgba(44,44,44,0.1); transform: translateY(-1px); }
        .pb-card { transition: box-shadow 0.2s, transform 0.2s; }
        @media (max-width: 640px) {
          .pb-week-grid { flex-direction: column !important; }
          .pb-day-col { border-right: none !important; border-bottom: 1px solid #E8E0D8; }
          .pb-day-col:last-child { border-bottom: none; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ background: sage, height: 64, padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}>
          {b.logo_url
            ? <img src={b.logo_url} alt={name} style={{ height: 44, maxWidth: 160, objectFit: "contain" }} />
            : <>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: "white" }}>{letter}</div>
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: "white", fontWeight: 300, letterSpacing: "0.05em", lineHeight: 1.1 }}>{name}</div>
                  {b.nav_name && b.nav_name !== name && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{b.nav_name}</div>}
                </div>
              </>}
        </a>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={() => setLang(lang === "pl" ? "en" : "pl")}
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "white", padding: "0.5rem 0.85rem", borderRadius: 8, fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <PbIcon name="globe" size={14} color="white" /> {lang === "pl" ? "EN" : "PL"}
            </button>
          <a href="/login" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "white", padding: "0.5rem 1.25rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", fontWeight: 500 }}>
            {t("Zaloguj się →", "Log in →")}
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 4rem" }}>

        {/* TYTUŁ SEKCJI */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2rem", color: "#2C2C2C", marginBottom: "0.35rem", fontWeight: 400 }}>
            {isServices ? t("Umów wizytę", "Book an appointment") : t("Harmonogram zajęć", "Class schedule")}
          </h2>
          <p style={{ color: "#6B6B6B", fontSize: "0.9rem" }}>
            {isServices
              ? t("Sprawdź dostępne terminy i zaloguj się, aby zarezerwować", "Check available slots and log in to book")
              : t("Kliknij zajęcia, aby zobaczyć szczegóły i się zapisać", "Click a class to see details and sign up")}
          </p>
        </div>

        {/* NAWIGACJA TYGODNIOWA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
          <button onClick={prevWeek} disabled={isPrevDisabled}
            style={{ padding: "0.45rem 1rem", border: "1px solid #E8E0D8", borderRadius: 8, background: "white", cursor: isPrevDisabled ? "not-allowed" : "pointer", color: isPrevDisabled ? "#ADADAD" : "#2C2C2C", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <PbIcon name="arrowLeft" size={14} color={isPrevDisabled ? "#ADADAD" : "#2C2C2C"} /> {t("Poprzedni", "Previous")}
          </button>
          <span style={{ fontWeight: 500, fontSize: "0.95rem", color: "#2C2C2C", textAlign: "center", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <PbIcon name="calendar" size={15} color={sage} /> {weekLabel}
          </span>
          <button onClick={nextWeek}
            style={{ padding: "0.45rem 1rem", border: "1px solid #E8E0D8", borderRadius: 8, background: "white", cursor: "pointer", color: "#2C2C2C", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {t("Następny", "Next")} <PbIcon name="arrowRight" size={14} color="#2C2C2C" />
          </button>
        </div>

        {/* KALENDARZ TYGODNIOWY */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#ADADAD" }}>{t("Ładowanie...", "Loading...")}</div>
        ) : !hasAnyFuture ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8" }}>
            <div style={{ marginBottom: "0.75rem", opacity: 0.3, display: "flex", justifyContent: "center" }}><PbIcon name="leaf" size={36} color={sage} /></div>
            <p style={{ color: "#ADADAD" }}>{isServices ? t("Brak nadchodzących wizyt.", "No upcoming appointments.") : t("Brak nadchodzących zajęć.", "No upcoming classes.")}</p>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E8E0D8", borderRadius: 12, overflow: "hidden" }}>
            {weeks.map((weekDays, wi) => {
              const weekClasses = periodClasses.filter(c =>
                weekDays.some(d => new Date(c.starts_at).toDateString() === d.toDateString())
              );
              return (
                <div key={wi} style={{ borderBottom: wi < NUM_WEEKS - 1 ? "2px solid #E8E0D8" : "none" }}>
                  {/* Nagłówki dni */}
                  <div className="pb-week-grid" style={{ display: "flex", borderBottom: "1px solid #E8E0D8" }}>
                    {weekDays.map((day, i) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      const cnt = weekClasses.filter(c => new Date(c.starts_at).toDateString() === day.toDateString()).length;
                      return (
                        <div key={i} className="pb-day-col" style={{ borderRight: i < 6 ? "1px solid #E8E0D8" : "none", padding: "0.55rem 0.5rem", textAlign: "center", background: isToday ? `${sage}12` : wi % 2 === 1 ? "#FDFAF6" : "transparent", minWidth: 0 }}>
                          <div style={{ fontSize: "0.65rem", color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.06em" }}>{DAY_NAMES[i]}</div>
                          <div style={{ fontSize: "1rem", fontWeight: isToday ? 700 : 400, color: isToday ? sage : "#2C2C2C", width: 26, height: 26, borderRadius: "50%", background: isToday ? `${sage}22` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", margin: "0.1rem auto 0" }}>
                            {day.getDate()}
                          </div>
                          {cnt > 0 && <div style={{ marginTop: "0.15rem", fontSize: "0.6rem", color: sage, fontWeight: 600 }}>{cnt}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Karty zajęć */}
                  <div className="pb-week-grid" style={{ display: "flex", minHeight: 100, background: wi % 2 === 1 ? "#FDFAF6" : "white" }}>
                    {weekDays.map((day, i) => {
                      const dayClasses = weekClasses.filter(c => new Date(c.starts_at).toDateString() === day.toDateString());
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <div key={i} className="pb-day-col" style={{ borderRight: i < 6 ? "1px solid #E8E0D8" : "none", padding: "0.5rem", background: isToday ? `${sage}06` : "transparent", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {dayClasses.length === 0 ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "0.65rem", color: "#E0D8D0" }}>—</span>
                            </div>
                          ) : dayClasses.map(cls => {
                            const isFull = (cls.bookings?.length || 0) >= cls.max_spots;
                            return (
                              <div key={cls.id} className="pb-card" onClick={() => setSelectedClass(cls)}
                                style={{ background: isFull ? "#FDE8E8" : `${sage}12`, border: `1px solid ${isFull ? "#F5C6C6" : `${sage}40`}`, borderLeft: `3px solid ${isFull ? clay : sage}`, borderRadius: 6, padding: "0.45rem 0.5rem", cursor: "pointer" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2C2C2C", lineHeight: 1.2, marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cls.name}</div>
                                <div style={{ fontSize: "0.68rem", color: "#6B6B6B" }}>{formatTime(cls.starts_at)}</div>
                                {cls.duration_min && <div style={{ fontSize: "0.65rem", color: "#ADADAD" }}>{cls.duration_min} min</div>}
                                {cls.staff?.name && <div style={{ fontSize: "0.65rem", color: sage, fontWeight: 500, marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.2rem" }}><PbIcon name="user" size={11} color={sage} /> {cls.staff.name}</div>}
                                {cls.price_pln > 0 && <div style={{ fontSize: "0.65rem", color: "#6B6B6B" }}>{cls.price_pln} zł</div>}
                                <div style={{ fontSize: "0.62rem", color: isFull ? "#C44B4B" : sage, marginTop: "0.2rem", fontWeight: 500 }}>
                                  {isFull ? t("Brak miejsc", "Full") : t("Wolne", "Available")}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!hasThisWeek && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#ADADAD", fontSize: "0.9rem" }}>
                {isServices
                  ? t("Brak wizyt w tym okresie.", "No appointments in this period.")
                  : t("Brak zajęć w tym okresie.", "No classes in this period.")}
              </div>
            )}
          </div>
        )}

        {/* LEGENDA + CTA */}
        {!loading && hasAnyFuture && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {[[t("Wolne miejsca", "Available"), sage], [t("Brak miejsc", "Full"), clay]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#6B6B6B" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: `${color}30`, border: `2px solid ${color}` }} />
                  {label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.78rem", color: "#ADADAD" }}>
              {isServices
                ? t("Kliknij wizytę aby zobaczyć szczegóły", "Click an appointment to see details")
                : t("Kliknij zajęcia aby zobaczyć szczegóły", "Click a class to see details")}
            </p>
          </div>
        )}

        {/* CTA - zaloguj się */}
        <div style={{ textAlign: "center", marginTop: "2.5rem", padding: "2rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8" }}>
          <p style={{ color: "#6B6B6B", marginBottom: "1rem", fontSize: "0.9rem" }}>
            {isServices
              ? t("Aby się umówić, zaloguj się lub załóż konto", "To book an appointment, log in or create an account")
              : t("Aby się zapisać, zaloguj się lub załóż konto", "To sign up, log in or create an account")}
          </p>
          <a href="/login" style={{ display: "inline-block", background: sage, color: "white", padding: "0.75rem 2rem", borderRadius: 8, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            {isServices ? t("Zarezerwuj wizytę →", "Book appointment →") : t("Zapisz się na zajęcia →", "Sign up for a class →")}
          </a>
        </div>

        {/* FORMULARZ KONTAKTOWY */}
        <div style={{ marginTop: "2.5rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8", padding: "2rem" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.6rem", color: "#2C2C2C", marginBottom: "0.35rem", fontWeight: 400 }}>{t("Napisz do nas", "Contact us")}</h2>
          <p style={{ color: "#6B6B6B", fontSize: "0.85rem", marginBottom: "1.5rem" }}>{t("Masz pytanie? Chcesz dowiedzieć się więcej? Odezwiemy się!", "Have a question? Want to know more? We'll get back to you!")}</p>
          {contactSent ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}><PbIcon name="checkCircle" size={40} color="#5C7A56" /></div>
              <p style={{ color: "#5C7A56", fontWeight: 500, marginBottom: "0.35rem" }}>{t("Wiadomość wysłana!", "Message sent!")}</p>
              <p style={{ color: "#6B6B6B", fontSize: "0.85rem" }}>{t("Odezwiemy się wkrótce.", "We'll be in touch soon.")}</p>
            </div>
          ) : (
            <form onSubmit={sendContact} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>{t("Imię i nazwisko *", "Full name *")}</label>
                  <input required value={contactName} onChange={e => setContactName(e.target.value)} placeholder={t("Anna Kowalska", "John Smith")} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t("Email lub telefon", "Email or phone")}</label>
                  <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} placeholder={t("anna@email.pl lub 500 000 000", "john@email.com or +44 7700 000 000")} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t("Wiadomość *", "Message *")}</label>
                <textarea required rows={4} value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder={t("Napisz czego potrzebujesz…", "Write what you need…")} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              {/* honeypot — niewidoczne dla ludzi, boty to wypełnią */}
              <input tabIndex={-1} aria-hidden="true" value={honeypot} onChange={e => setHoneypot(e.target.value)} style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }} autoComplete="off" />
              <button type="submit" disabled={contactSending} style={{ background: sage, color: "white", border: "none", padding: "0.85rem", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: "0.9rem", cursor: contactSending ? "not-allowed" : "pointer", opacity: contactSending ? 0.7 : 1 }}>
                {contactSending ? t("Wysyłanie…", "Sending…") : t("Wyślij wiadomość →", "Send message →")}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: "#ADADAD" }}>
          {name}{b.app_url ? ` · ${b.app_url.replace(/^https?:\/\//, "")}` : ""}
        </p>
      </div>

      {/* MODAL SZCZEGÓŁÓW */}
      {selectedClass && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,44,44,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setSelectedClass(null)}>
          <div style={{ background: "white", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem" }}>
              <div>
                <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.5rem", fontWeight: 400, marginBottom: "0.25rem" }}>{selectedClass.name}</h3>
                {selectedClass.staff?.name && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "#6B6B6B" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: selectedClass.staff.color || sage, display: "inline-block" }} />
                    {selectedClass.staff.name}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedClass(null)} style={{ background: "none", border: "none", color: "#ADADAD", cursor: "pointer", flexShrink: 0, padding: "0.25rem", display: "flex" }}><PbIcon name="xmark" size={18} color="#ADADAD" /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { icon: "calendar", label: t("Data", "Date"), val: formatDate(selectedClass.starts_at) },
                { icon: "clock", label: t("Godzina", "Time"), val: `${formatTime(selectedClass.starts_at)} · ${selectedClass.duration_min} min` },
                selectedClass.location && { icon: "mapPin", label: t("Lokalizacja", "Location"), val: selectedClass.location, maps: true },
                selectedClass.price_pln && { icon: "money", label: t("Cena", "Price"), val: `${selectedClass.price_pln} zł` },
                selectedClass.max_spots > 1 && { icon: "users", label: t("Miejsca", "Spots"), val: (selectedClass.bookings?.length || 0) >= selectedClass.max_spots ? t("Brak wolnych miejsc", "Full") : t("Wolne miejsca", "Available") },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ marginTop: "0.15rem", flexShrink: 0 }}><PbIcon name={item.icon} size={16} color={sage} /></span>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {item.val}
                      {item.maps && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.val)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.72rem", color: sage, textDecoration: "none", border: `1px solid ${sage}`, borderRadius: 10, padding: "0.1rem 0.45rem", whiteSpace: "nowrap" }}>{t("Nawiguj →", "Navigate →")}</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedClass.notes && (
              <div style={{ background: cream, borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "#2C2C2C", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, marginTop: "0.1rem" }}><PbIcon name="note" size={15} color={sage} /></span>
                {selectedClass.notes}
              </div>
            )}

            {selectedClass.bookings?.length >= selectedClass.max_spots ? (
              <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "0.875rem", textAlign: "center", color: "#C44B4B", fontSize: "0.875rem", fontWeight: 500 }}>
                {t("Brak wolnych miejsc", "No spots available")}
              </div>
            ) : guestBooked ? (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
                  <PbIcon name="checkCircle" size={40} color="#5C7A56" />
                </div>
                <div style={{ fontWeight: 600, color: "#5C7A56", marginBottom: "0.35rem" }}>{t("Rezerwacja potwierdzona!", "Booking confirmed!")}</div>
                <div style={{ fontSize: "0.85rem", color: "#6B6B6B" }}>{t("Sprawdź email — wysłaliśmy link do zarządzania rezerwacją.", "Check your email — we sent a management link.")}</div>
              </div>
            ) : (
              <form onSubmit={submitGuestBook} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem" }}>
                  {t("Zarezerwuj bez konta", "Book without account")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input required placeholder={t("Imię *", "First name *")} value={guestForm.firstName}
                    onChange={e => setGuestForm(f => ({ ...f, firstName: e.target.value }))} style={inputStyle} />
                  <input placeholder={t("Nazwisko", "Last name")} value={guestForm.lastName}
                    onChange={e => setGuestForm(f => ({ ...f, lastName: e.target.value }))} style={inputStyle} />
                </div>
                <input required type="email" placeholder={t("Email *", "Email *")} value={guestForm.email}
                  onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                <input required type="tel" placeholder={t("Telefon *", "Phone *")} value={guestForm.phone}
                  onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
                {guestError && <div style={{ fontSize: "0.82rem", color: "#C44B4B" }}>{guestError}</div>}
                <button type="submit" disabled={guestSending}
                  style={{ background: sage, color: "white", border: "none", padding: "0.75rem", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontWeight: 500, cursor: guestSending ? "not-allowed" : "pointer", opacity: guestSending ? 0.7 : 1 }}>
                  {guestSending ? t("Rezerwowanie…", "Booking…") : t("Zarezerwuj →", "Book →")}
                </button>
                <div style={{ textAlign: "center", fontSize: "0.78rem", color: "#ADADAD" }}>
                  {t("Masz konto?", "Have an account?")} <a href="/login" style={{ color: sage }}>{t("Zaloguj się", "Log in")}</a>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
