import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function PublicBooking() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    const now = new Date().toISOString();
    const { data } = await supabase.from("classes")
      .select("*, bookings(id)")
      .gte("starts_at", now)
      .or("cancelled.is.null,cancelled.eq.false")
      .order("starts_at", { ascending: true });
    setClasses(data || []);
    setLoading(false);
  }

  function formatDate(iso) { return new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }); }
  function formatTime(iso) { return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }); }

  async function sendContact(e) {
    e.preventDefault();
    if (!contactName.trim() || !contactMsg.trim()) return;
    setContactSending(true);
    await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: contactName, contact: contactInfo, message: contactMsg }),
    }).catch(() => {});
    setContactSending(false);
    setContactSent(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F3EE", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: "#8A9E85", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2.5rem", color: "white", fontWeight: 300, letterSpacing: "0.1em" }}>Pilates</h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>Studio by Paulina</p>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.8rem", color: "#2C2C2C", marginBottom: "0.5rem" }}>Nadchodzące zajęcia</h2>
          <p style={{ color: "#6B6B6B", fontSize: "0.9rem" }}>Kliknij aby zobaczyć szczegóły i zapisać się</p>
        </div>

        {/* Filtr lokalizacji */}
        {!loading && classes.length > 0 && (() => {
          const locations = [...new Set(classes.map(c => c.location).filter(Boolean))];
          if (locations.length < 2) return null;
          return (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              <button onClick={() => setLocationFilter("")} style={{ padding: "0.35rem 0.85rem", borderRadius: 20, border: "1px solid #E8E0D8", background: locationFilter === "" ? "#8A9E85" : "white", color: locationFilter === "" ? "white" : "#6B6B6B", fontSize: "0.8rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Wszystkie</button>
              {locations.map(loc => (
                <button key={loc} onClick={() => setLocationFilter(loc)} style={{ padding: "0.35rem 0.85rem", borderRadius: 20, border: "1px solid #E8E0D8", background: locationFilter === loc ? "#8A9E85" : "white", color: locationFilter === loc ? "white" : "#6B6B6B", fontSize: "0.8rem", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>📍 {loc}</button>
              ))}
            </div>
          );
        })()}

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#ADADAD" }}>Ładowanie...</div>
        ) : classes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#ADADAD" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>🌿</div>
            <p>Brak nadchodzących zajęć.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {classes.filter(cls => !locationFilter || cls.location === locationFilter).map(cls => {
              const count = cls.bookings?.length || 0;
              const isFull = count >= cls.max_spots;
              const fillPct = Math.min((count / cls.max_spots) * 100, 100);
              return (
                <div key={cls.id} onClick={() => setSelectedClass(cls)}
                  style={{ background: "white", border: "1px solid #E8E0D8", borderRadius: 12, padding: "1.25rem 1.5rem", cursor: "pointer", transition: "box-shadow 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(44,44,44,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: "#2C2C2C", fontWeight: 400 }}>{cls.name}</h3>
                    <span style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem", borderRadius: 20, fontWeight: 500, background: isFull ? "#FDE8E8" : "#EBF5EA", color: isFull ? "#C44B4B" : "#5C7A56" }}>
                      {isFull ? "Brak miejsc" : "Wolne miejsca"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#6B6B6B" }}>📅 {formatDate(cls.starts_at)}</div>
                    <div style={{ fontSize: "0.85rem", color: "#6B6B6B" }}>🕐 {formatTime(cls.starts_at)} · {cls.duration_min} min</div>
                    {cls.location && <div style={{ fontSize: "0.85rem", color: "#6B6B6B" }}>📍 {cls.location}</div>}
                    {cls.price_pln && <div style={{ fontSize: "0.85rem", color: "#6B6B6B" }}>💰 {cls.price_pln} zł</div>}
                  </div>
                  <div style={{ height: 4, background: "#E8E0D8", borderRadius: 2, overflow: "hidden", marginBottom: "0.4rem" }}>
                    <div style={{ width: `${fillPct}%`, height: "100%", background: isFull ? "#C44B4B" : "#8A9E85", borderRadius: 2 }} />
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#ADADAD" }}>{count} / {cls.max_spots} miejsc</p>
                  {cls.notes && <p style={{ fontSize: "0.8rem", color: "#6B6B6B", marginTop: "0.5rem", fontStyle: "italic" }}>📌 {cls.notes}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA - zapisz się */}
        <div style={{ textAlign: "center", marginTop: "3rem", padding: "2rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8" }}>
          <p style={{ color: "#6B6B6B", marginBottom: "1rem", fontSize: "0.9rem" }}>Aby się zapisać, zaloguj się lub załóż konto</p>
          <a href="/" style={{ display: "inline-block", background: "#8A9E85", color: "white", padding: "0.75rem 2rem", borderRadius: 8, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            Przejdź do aplikacji →
          </a>
        </div>

        {/* Formularz kontaktowy */}
        <div style={{ marginTop: "3rem", background: "white", borderRadius: 12, border: "1px solid #E8E0D8", padding: "2rem" }}>
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
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem" }}>Imię i nazwisko *</label>
                  <input required value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Anna Kowalska" style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1px solid #E8E0D8", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem" }}>Email lub telefon</label>
                  <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} placeholder="anna@email.pl lub 500 000 000" style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1px solid #E8E0D8", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.35rem" }}>Wiadomość *</label>
                <textarea required rows={4} value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder="Napisz czego potrzebujesz…" style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1px solid #E8E0D8", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <button type="submit" disabled={contactSending} style={{ background: "#8A9E85", color: "white", border: "none", padding: "0.85rem", borderRadius: 8, fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: "0.9rem", cursor: contactSending ? "not-allowed" : "pointer", opacity: contactSending ? 0.7 : 1 }}>
                {contactSending ? "Wysyłanie…" : "Wyślij wiadomość →"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: "#ADADAD" }}>
          Pilates Studio by Paulina · paulapilates.pl
        </p>
      </div>

      {/* Modal szczegółów */}
      {selectedClass && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,44,44,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setSelectedClass(null)}>
          <div style={{ background: "white", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.5rem", fontWeight: 400 }}>{selectedClass.name}</h3>
              <button onClick={() => setSelectedClass(null)} style={{ background: "none", border: "none", fontSize: "1.4rem", color: "#ADADAD", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { icon: "📅", label: "Data", val: formatDate(selectedClass.starts_at) },
                { icon: "🕐", label: "Godzina", val: `${formatTime(selectedClass.starts_at)} · ${selectedClass.duration_min} min` },
                selectedClass.location && { icon: "📍", label: "Lokalizacja", val: selectedClass.location },
                selectedClass.price_pln && { icon: "💰", label: "Cena", val: `${selectedClass.price_pln} zł` },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem" }}>
                  <span>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                    <div style={{ fontWeight: 500 }}>{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
            {selectedClass.notes && (
              <div style={{ background: "#F7F3EE", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", fontSize: "0.875rem", color: "#2C2C2C" }}>
                📌 {selectedClass.notes}
              </div>
            )}
            <a href="/" style={{ display: "block", background: "#8A9E85", color: "white", padding: "0.875rem", borderRadius: 8, textDecoration: "none", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              Zaloguj się i zapisz →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
