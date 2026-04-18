import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useStudio } from "../StudioContext";

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
const MONTH_NAMES = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export default function PublicBooking({ studioId }) {
  const { studio } = useStudio();
  const b = studio?.branding || {};
  const name = studio?.name || "Studio";
  const letter = name[0] || "S";
  const serviceMode = studio?.features?.service_mode || "classes";
  const isServices = serviceMode === "services";
  const itemLabel = isServices ? "Wizyty" : "Zajęcia";

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
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  useEffect(() => { fetchClasses(); }, []);

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
    return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekClasses = classes.filter(c => {
    const d = new Date(c.starts_at);
    return d >= weekStart && d < weekEnd;
  });

  const hasAnyFuture = classes.length > 0;
  const hasThisWeek = weekClasses.length > 0;

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    if (d >= getMonday(new Date())) setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  const isPrevDisabled = weekStart <= getMonday(new Date());
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${new Date(weekEnd.getTime() - 1).getDate()} ${MONTH_NAMES[new Date(weekEnd.getTime() - 1).getMonth()]} ${weekEnd.getFullYear()}`;

  async function sendContact(e) {
    e.preventDefault();
    if (!contactName.trim() || !contactMsg.trim()) return;
    setContactSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName, contact: contactInfo, message: contactMsg, studioId }),
      });
      const json = await res.json();
      if (!res.ok) { alert("Błąd: " + (json.error || res.status)); setContactSending(false); return; }
    } catch (err) {
      alert("Błąd połączenia: " + err.message);
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
      <div style={{ background: sage, padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
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
        <a href="/" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "white", padding: "0.5rem 1.25rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem", fontFamily: "DM Sans, sans-serif", fontWeight: 500 }}>
          Zaloguj się →
        </a>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 4rem" }}>

        {/* TYTUŁ SEKCJI */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2rem", color: "#2C2C2C", marginBottom: "0.35rem", fontWeight: 400 }}>
            {isServices ? "Umów wizytę" : "Harmonogram zajęć"}
          </h2>
          <p style={{ color: "#6B6B6B", fontSize: "0.9rem" }}>
            {isServices ? "Sprawdź dostępne terminy i zaloguj się, aby zarezerwować" : "Kliknij zajęcia, aby zobaczyć szczegóły i się zapisać"}
          </p>
        </div>

        {/* NAWIGACJA TYGODNIOWA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
          <button onClick={prevWeek} disabled={isPrevDisabled}
            style={{ padding: "0.45rem 1rem", border: "1px solid #E8E0D8", borderRadius: 8, background: "white", cursor: isPrevDisabled ? "not-allowed" : "pointer", color: isPrevDisabled ? "#ADADAD" : "#2C2C2C", fontSize: "0.85rem" }}>
            ← Poprzedni
          </button>
          <span style={{ fontWeight: 500, fontSize: "0.95rem", color: "#2C2C2C", textAlign: "center" }}>
            📅 {weekLabel}
          </span>
          <button onClick={nextWeek}
            style={{ padding: "0.45rem 1rem", border: "1px solid #E8E0D8", borderRadius: 8, background: "white", cursor: "pointer", color: "#2C2C2C", fontSize: "0.85rem" }}>
            Następny →
          </button>
        </div>

        {/* KALENDARZ TYGODNIOWY */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#ADADAD" }}>Ładowanie...</div>
        ) : !hasAnyFuture ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>🌿</div>
            <p style={{ color: "#ADADAD" }}>Brak nadchodzących {isServices ? "wizyt" : "zajęć"}.</p>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #E8E0D8", borderRadius: 12, overflow: "hidden" }}>
            {/* Nagłówki dni */}
            <div className="pb-week-grid" style={{ display: "flex", borderBottom: "2px solid #E8E0D8" }}>
              {weekDays.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const dayClasses = weekClasses.filter(c => new Date(c.starts_at).toDateString() === day.toDateString());
                return (
                  <div key={i} className="pb-day-col" style={{ borderRight: i < 6 ? "1px solid #E8E0D8" : "none", padding: "0.65rem 0.5rem", textAlign: "center", background: isToday ? `${sage}12` : "transparent", minWidth: 0 }}>
                    <div style={{ fontSize: "0.7rem", color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.06em" }}>{DAY_NAMES[i]}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: isToday ? 700 : 400, color: isToday ? sage : "#2C2C2C", width: 28, height: 28, borderRadius: "50%", background: isToday ? `${sage}22` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", margin: "0.15rem auto 0" }}>
                      {day.getDate()}
                    </div>
                    {dayClasses.length > 0 && (
                      <div style={{ marginTop: "0.2rem", fontSize: "0.65rem", color: sage, fontWeight: 600 }}>{dayClasses.length} {isServices ? (dayClasses.length === 1 ? "wizyta" : "wizyty") : (dayClasses.length === 1 ? "zajęcia" : "zajęć")}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Karty zajęć */}
            <div className="pb-week-grid" style={{ display: "flex", minHeight: 120 }}>
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
                      const count = cls.bookings?.length || 0;
                      const isFull = count >= cls.max_spots;
                      const singleSpot = cls.max_spots === 1;
                      return (
                        <div key={cls.id} className="pb-card" onClick={() => setSelectedClass(cls)}
                          style={{ background: isFull ? "#FDE8E8" : `${sage}12`, border: `1px solid ${isFull ? "#F5C6C6" : `${sage}40`}`, borderLeft: `3px solid ${isFull ? clay : sage}`, borderRadius: 6, padding: "0.45rem 0.5rem", cursor: "pointer" }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2C2C2C", lineHeight: 1.2, marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cls.name}</div>
                          <div style={{ fontSize: "0.68rem", color: "#6B6B6B" }}>{formatTime(cls.starts_at)}</div>
                          {cls.duration_min && <div style={{ fontSize: "0.65rem", color: "#ADADAD" }}>{cls.duration_min} min</div>}
                          {cls.staff?.name && <div style={{ fontSize: "0.65rem", color: sage, fontWeight: 500, marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👤 {cls.staff.name}</div>}
                          {cls.price_pln > 0 && <div style={{ fontSize: "0.65rem", color: "#6B6B6B" }}>{cls.price_pln} zł</div>}
                          {!singleSpot && (
                            <div style={{ marginTop: "0.3rem", height: 3, background: "#E8E0D8", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min((count / cls.max_spots) * 100, 100)}%`, height: "100%", background: isFull ? clay : sage, borderRadius: 2 }} />
                            </div>
                          )}
                          <div style={{ fontSize: "0.62rem", color: isFull ? "#C44B4B" : "#ADADAD", marginTop: "0.15rem" }}>
                            {isFull ? "Brak miejsc" : singleSpot ? "Dostępne" : `${cls.max_spots - count} wolnych`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {!hasThisWeek && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#ADADAD", borderTop: "1px solid #E8E0D8", fontSize: "0.9rem" }}>
                Brak {isServices ? "wizyt" : "zajęć"} w tym tygodniu — sprawdź kolejny.
              </div>
            )}
          </div>
        )}

        {/* LEGENDA + CTA */}
        {!loading && hasAnyFuture && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {[["Wolne miejsca", sage], ["Brak miejsc", clay]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#6B6B6B" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: `${color}30`, border: `2px solid ${color}` }} />
                  {label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.78rem", color: "#ADADAD" }}>Kliknij {isServices ? "wizytę" : "zajęcia"} aby zobaczyć szczegóły</p>
          </div>
        )}

        {/* CTA - zaloguj się */}
        <div style={{ textAlign: "center", marginTop: "2.5rem", padding: "2rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8" }}>
          <p style={{ color: "#6B6B6B", marginBottom: "1rem", fontSize: "0.9rem" }}>
            Aby się {isServices ? "umówić" : "zapisać"}, zaloguj się lub załóż konto
          </p>
          <a href="/" style={{ display: "inline-block", background: sage, color: "white", padding: "0.75rem 2rem", borderRadius: 8, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            {isServices ? "Zarezerwuj wizytę →" : "Zapisz się na zajęcia →"}
          </a>
        </div>

        {/* FORMULARZ KONTAKTOWY */}
        <div style={{ marginTop: "2.5rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8", padding: "2rem" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.6rem", color: "#2C2C2C", marginBottom: "0.35rem", fontWeight: 400 }}>Napisz do nas</h2>
          <p style={{ color: "#6B6B6B", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Masz pytanie? Chcesz dowiedzieć się więcej? Odezwiemy się!</p>
          {contactSent ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
              <p style={{ color: "#5C7A56", fontWeight: 500, marginBottom: "0.35rem" }}>Wiadomość wysłana!</p>
              <p style={{ color: "#6B6B6B", fontSize: "0.85rem" }}>Odezwiemy się wkrótce.</p>
            </div>
          ) : (
            <form onSubmit={sendContact} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div><label style={labelStyle}>Imię i nazwisko *</label><input required value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Anna Kowalska" style={inputStyle} /></div>
                <div><label style={labelStyle}>Email lub telefon</label><input value={contactInfo} onChange={e => setContactInfo(e.target.value)} placeholder="anna@email.pl lub 500 000 000" style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Wiadomość *</label><textarea required rows={4} value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder="Napisz czego potrzebujesz…" style={{ ...inputStyle, resize: "vertical" }} /></div>
              <button type="submit" disabled={contactSending} style={{ background: sage, color: "white", border: "none", padding: "0.85rem", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: "0.9rem", cursor: contactSending ? "not-allowed" : "pointer", opacity: contactSending ? 0.7 : 1 }}>
                {contactSending ? "Wysyłanie…" : "Wyślij wiadomość →"}
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
              <button onClick={() => setSelectedClass(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", color: "#ADADAD", cursor: "pointer", flexShrink: 0 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { icon: "📅", label: "Data", val: formatDate(selectedClass.starts_at) },
                { icon: "🕐", label: "Godzina", val: `${formatTime(selectedClass.starts_at)} · ${selectedClass.duration_min} min` },
                selectedClass.location && { icon: "📍", label: "Lokalizacja", val: selectedClass.location, maps: true },
                selectedClass.price_pln && { icon: "💰", label: "Cena", val: `${selectedClass.price_pln} zł` },
                selectedClass.max_spots > 1 && { icon: "👥", label: "Miejsca", val: `${selectedClass.max_spots - (selectedClass.bookings?.length || 0)} wolnych z ${selectedClass.max_spots}` },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem" }}>
                  <span>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {item.val}
                      {item.maps && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.val)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.72rem", color: sage, textDecoration: "none", border: `1px solid ${sage}`, borderRadius: 10, padding: "0.1rem 0.45rem", whiteSpace: "nowrap" }}>Nawiguj →</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedClass.notes && (
              <div style={{ background: cream, borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "#2C2C2C" }}>
                📌 {selectedClass.notes}
              </div>
            )}

            {selectedClass.bookings?.length >= selectedClass.max_spots ? (
              <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "0.875rem", textAlign: "center", color: "#C44B4B", fontSize: "0.875rem", fontWeight: 500 }}>
                Brak wolnych miejsc
              </div>
            ) : (
              <a href="/" style={{ display: "block", background: sage, color: "white", padding: "0.875rem", borderRadius: 8, textDecoration: "none", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {isServices ? "Zaloguj się i zarezerwuj →" : "Zaloguj się i zapisz →"}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
