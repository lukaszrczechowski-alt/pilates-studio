import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";
import { sendEmail, formatEmailDate, formatEmailTime } from "../emailService";
import { sendSms, smsDate } from "../smsService";

export default function ClientDashboard({ session, profile, studioId, onProfileUpdate, darkMode, setDarkMode }) {
  const { studio } = useStudio();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const locale = lang === "en" ? "en-GB" : "pl-PL";
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const studioName = studio?.name || "Studio";
  const studioLetter = studioName[0] || "S";
  const tokensEnabled = studio?.features?.tokens_enabled !== false;
  const serviceMode = studio?.features?.service_mode || "classes";
  const hasServices = serviceMode === "services";
  const multiStaff = hasServices && studio?.features?.multi_staff === true;
  const classLabel = hasServices ? t("Wizyty", "Appointments") : t("Zajęcia", "Classes");
  const [tab, setTab] = useState("upcoming");
  const [viewMode, setViewMode] = useState(() => window.innerWidth <= 768 ? "list" : "calendar");
  const [classes, setClasses] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [myTokens, setMyTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);
  const [detailClass, setDetailClass] = useState(null);
  const [showCancelWarning, setShowCancelWarning] = useState(null);
  const [showBookModal, setShowBookModal] = useState(null);
  const [calendarWeek, setCalendarWeek] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [mobileCalStart, setMobileCalStart] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [myRatings, setMyRatings] = useState([]);
  const [showRatingModal, setShowRatingModal] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifFilter, setNotifFilter] = useState("all");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [birthInput, setBirthInput] = useState("");
  const [birthSaving, setBirthSaving] = useState(false);

  useEffect(() => {
    setPhoneInput(profile?.phone || "");
  }, [profile?.phone]);

  useEffect(() => {
    setBirthInput(profile?.birth_date || "");
  }, [profile?.birth_date]);

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  useEffect(() => { if (studioId) fetchData(); }, [studioId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("platnosc") === "ok") {
      showMsg("Płatność zakończona! Rezerwacja potwierdzona. ✓");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function fetchData() {
    setLoading(true);
    const now = new Date().toISOString();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: classData } = await supabase.from("classes")
      .select("*, bookings(*), waitlist(*), staff(name, color)")
      .eq("studio_id", studioId)
      .gte("starts_at", startOfMonth.toISOString())
      .or("cancelled.is.null,cancelled.eq.false")
      .order("starts_at", { ascending: true });
    const { data: ratingsData } = await supabase.from("class_ratings")
      .select("*").eq("user_id", session.user.id);
    setMyRatings(ratingsData || []);
    const { data: bookingData } = await supabase.from("bookings").select("*, classes(*)")
      .eq("user_id", session.user.id).order("created_at", { ascending: false });
    const { data: waitlistData } = await supabase.from("waitlist").select("*, classes(*)")
      .eq("user_id", session.user.id);
    const { data: tokenData } = await supabase.from("tokens").select("*")
      .eq("user_id", session.user.id).order("year", { ascending: false }).order("month", { ascending: false });
    const { data: notifData } = await supabase.from("notifications")
      .select("*").eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setClasses(classData || []);
    setMyBookings(bookingData || []);
    setMyWaitlist(waitlistData || []);
    setMyTokens(tokenData || []);
    setNotifications(notifData || []);
    setUnreadCount((notifData || []).filter(n => !n.read).length);
    setLoading(false);
  }

  function isBooked(classId) { return myBookings.some(b => b.class_id === classId); }
  function getBooking(classId) { return myBookings.find(b => b.class_id === classId); }
  function isOnWaitlist(classId) { return myWaitlist.some(w => w.class_id === classId); }
  function getBookedCount(cls) { return cls.bookings?.length || 0; }

  function cancelStatus(startsAt) {
    const classDate = new Date(startsAt);
    const now = new Date();
    const isToday = classDate.toDateString() === now.toDateString();
    const isFuture = classDate > now;
    if (!isFuture && !isToday) return "past";
    if (!isToday) return "free";
    const cutoff = new Date(classDate);
    cutoff.setHours(12, 0, 0, 0);
    return now < cutoff ? "free" : "after_cutoff";
  }

  function monthName(m) {
    if (lang === "en") return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1];
    return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
  }

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleBook(cls, paymentMethod) {
    // Płatność online przez P24
    if (paymentMethod === "online") {
      setActionLoading(cls.id);
      try {
        const resp = await fetch("/api/p24", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ classId: cls.id }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          showMsg(data.error || "Błąd przy inicjowaniu płatności.", "error");
          setActionLoading(null);
          return;
        }
        window.location.href = data.redirectUrl;
      } catch (e) {
        showMsg("Błąd połączenia z bramką płatności.", "error");
        setActionLoading(null);
      }
      return;
    }

    setActionLoading(cls.id);
    const month = new Date(cls.starts_at).getMonth() + 1;
    const year = new Date(cls.starts_at).getFullYear();
    if (paymentMethod === "entries") {
      const { data: tok } = await supabase.from("tokens").select("amount")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).maybeSingle();
      if (!tok || tok.amount <= 0) {
        showMsg("Brak wejść na " + monthName(month) + ". Wybierz gotówkę.", "error");
        setActionLoading(null); return;
      }
    }
    const { error } = await supabase.from("bookings").insert({ class_id: cls.id, user_id: session.user.id, payment_method: paymentMethod, studio_id: studioId });
    if (error) { console.error("booking insert error:", error); showMsg(`Błąd przy zapisie: ${error.message}`, "error"); setActionLoading(null); return; }
    if (paymentMethod === "entries") {
      const { data: tok } = await supabase.from("tokens").select("*")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).maybeSingle();
      if (tok) {
        await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
        await supabase.from("token_history").insert({ user_id: session.user.id, class_id: cls.id, operation: "use", amount: -1, month, year, note: `Zapis: ${cls.name}`, studio_id: studioId });
      }
    }
    await sendEmail("booking_confirmed", profile.email, {
      firstName: profile.first_name, className: cls.name,
      date: formatEmailDate(cls.starts_at), time: formatEmailTime(cls.starts_at),
      duration: cls.duration_min, location: cls.location || "", notes: cls.notes || "", paymentMethod,
    });
    showMsg(paymentMethod === "entries" ? "Zapisano! Zdjęto 1 wejście. ✓" : "Zapisano! Płatność gotówką. ✓");
    setShowBookModal(null); setDetailClass(null);
    await fetchData(); setActionLoading(null);
  }

  async function handleBookSeries(seriesId, method) {
    // Znajdź wszystkie przyszłe zajęcia z tej serii, na które użytkownik nie jest jeszcze zapisany
    const now = new Date();
    const bookedIds = new Set(myBookings.map(b => b.class_id));
    const seriesClasses = classes.filter(c =>
      c.series_id === seriesId &&
      new Date(c.starts_at) >= now &&
      !bookedIds.has(c.id) &&
      !c.cancelled
    );
    if (seriesClasses.length === 0) {
      showMsg("Jesteś już zapisany/a na wszystkie zajęcia z tej serii.", "error");
      return;
    }
    setActionLoading("series");
    let booked = 0;
    for (const cls of seriesClasses) {
      const { error } = await supabase.from("bookings").insert({
        class_id: cls.id, user_id: session.user.id, payment_method: method, studio_id: studioId,
      });
      if (!error) {
        if (method === "entries") {
          const month = new Date(cls.starts_at).getMonth() + 1;
          const year = new Date(cls.starts_at).getFullYear();
          const { data: tok } = await supabase.from("tokens").select("*")
            .eq("user_id", session.user.id).eq("month", month).eq("year", year).maybeSingle();
          if (tok && tok.amount > 0) {
            await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
            await supabase.from("token_history").insert({ user_id: session.user.id, class_id: cls.id, operation: "use", amount: -1, month, year, note: `Zapis (seria): ${cls.name}`, studio_id: studioId });
          }
        }
        booked++;
      }
    }
    showMsg(`Zapisano na ${booked} ${booked === 1 ? "zajęcia" : booked < 5 ? "zajęcia" : "zajęć"} z serii! ✓`);
    setShowBookModal(null); setDetailClass(null);
    await fetchData(); setActionLoading(null);
  }

  async function handleCancel(booking, force = false) {
    const cls = booking.classes || classes.find(c => c.id === booking.class_id);
    if (!cls) return;
    if (!booking.id) { showMsg("Błąd — brak ID rezerwacji.", "error"); return; }
    const status = cancelStatus(cls.starts_at);
    if (status === "after_cutoff" && !force) { setShowCancelWarning(booking); setDetailClass(null); return; }
    setActionLoading(booking.class_id || booking.id);
    await supabase.from("bookings").delete().eq("id", booking.id);
    let refunded = false, lostEntry = false;
    if (booking.payment_method === "entries" && status === "free") {
      const month = new Date(cls.starts_at).getMonth() + 1;
      const year = new Date(cls.starts_at).getFullYear();
      const { data: tok } = await supabase.from("tokens").select("*")
        .eq("user_id", session.user.id).eq("month", month).eq("year", year).maybeSingle();
      if (tok) {
        await supabase.from("tokens").update({ amount: tok.amount + 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
        await supabase.from("token_history").insert({ user_id: session.user.id, class_id: cls.id, operation: "add", amount: 1, month, year, note: "Zwrot — anulowanie", studio_id: studioId });
        refunded = true;
      }
    } else if (booking.payment_method === "entries" && status === "after_cutoff") {
      lostEntry = true;
    }
    await sendEmail("booking_cancelled", profile.email, {
      firstName: profile.first_name, className: cls.name,
      date: formatEmailDate(cls.starts_at), time: formatEmailTime(cls.starts_at),
      refunded, lostEntry,
    });
    const { data: waitlistFirst } = await supabase.from("waitlist").select("*, profiles(first_name, email, phone)")
      .eq("class_id", cls.id).order("created_at", { ascending: true }).limit(1);
    if (waitlistFirst?.length > 0) {
      const promoted = waitlistFirst[0];
      await supabase.from("bookings").insert({ class_id: cls.id, user_id: promoted.user_id, payment_method: "cash", studio_id: studioId });
      await supabase.from("waitlist").delete().eq("id", promoted.id);
      await sendEmail("waitlist_promoted", promoted.profiles?.email, {
        firstName: promoted.profiles?.first_name, className: cls.name,
        date: formatEmailDate(cls.starts_at), time: formatEmailTime(cls.starts_at), location: cls.location || "",
      });
      await sendSms(promoted.profiles?.phone,
        `${promoted.profiles?.first_name}, zwolniło się miejsce na zajęciach "${cls.name}" (${smsDate(cls.starts_at)}). Masz rezerwację! — ${studioName}`
      );
    }
    if (refunded) showMsg("Anulowano. Wejście wróciło. ✓");
    else if (lostEntry) showMsg("Anulowano. Wejście przepadło (po 12:00).", "error");
    else showMsg("Anulowano rezerwację.");
    setShowCancelWarning(null); setDetailClass(null);
    await fetchData(); setActionLoading(null);
  }

  async function handleJoinWaitlist(cls) {
    setActionLoading(cls.id);
    const { error } = await supabase.from("waitlist").insert({ class_id: cls.id, user_id: session.user.id, studio_id: studioId });
    if (error) showMsg("Już jesteś w kolejce.", "error");
    else { showMsg("Zapisano do kolejki! ✓"); setDetailClass(null); }
    await fetchData(); setActionLoading(null);
  }

  async function handleLeaveWaitlist(cls) {
    setActionLoading(cls.id);
    await supabase.from("waitlist").delete().eq("class_id", cls.id).eq("user_id", session.user.id);
    showMsg("Usunięto z kolejki."); setDetailClass(null);
    await fetchData(); setActionLoading(null);
  }

  function formatDate(iso) { return new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function formatDateShort(iso) { return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); }
  function formatTime(iso) { return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }); }

  const upcomingMyClasses = myBookings.filter(b => new Date(b.classes?.starts_at) >= new Date() && !b.classes?.cancelled);
  const pastMyClasses = myBookings.filter(b => new Date(b.classes?.starts_at) < new Date())
    .sort((a, b) => new Date(b.classes?.starts_at) - new Date(a.classes?.starts_at));
  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date()); // tylko przyszłe — dla widoku listy
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentTokens = myTokens.find(t => t.month === currentMonth && t.year === currentYear);

  // Kalendarz tygodniowy
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(calendarWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayNames = lang === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

  function getClassesForDay(date) {
    return classes.filter(cls => {
      const d = new Date(cls.starts_at);
      return d.toDateString() === date.toDateString();
    });
  }

  function isToday(date) { return date.toDateString() === new Date().toDateString(); }

  function ClassPill({ cls }) {
    const booked = isBooked(cls.id);
    const onWaitlist = isOnWaitlist(cls.id);
    const count = getBookedCount(cls);
    const isFull = count >= cls.max_spots;
    let bg = booked ? "#EBF5EA" : onWaitlist ? "#FEF3E8" : isFull ? "#FDE8E8" : "white";
    let border = booked ? "#8A9E85" : onWaitlist ? "#E8C5B5" : isFull ? "#F5C6C6" : "var(--border)";
    let color = booked ? "#5C7A56" : onWaitlist ? "#B87333" : isFull ? "#C44B4B" : "var(--charcoal)";
    return (
      <div onClick={() => setDetailClass(cls)} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "0.4rem 0.6rem", cursor: "pointer", marginBottom: "0.3rem", transition: "opacity 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
        <div style={{ fontSize: "0.78rem", fontWeight: 500, color }}>{formatTime(cls.starts_at)}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--charcoal)", fontWeight: booked ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cls.name}</div>
        <div style={{ fontSize: "0.7rem", color: "var(--light)", marginTop: 1 }}>{count}/{cls.max_spots} {t("miejsc", "spots")}</div>
      </div>
    );
  }

  function BookModal({ cls, onClose }) {
    const [method, setMethod] = useState("cash");
    const [bookSeries, setBookSeries] = useState(false);
    const month = new Date(cls.starts_at).getMonth() + 1;
    const classTokens = myTokens.find(t => t.month === month && t.year === new Date(cls.starts_at).getFullYear());
    const classEntries = classTokens?.amount || 0;
    const bookedIds = new Set(myBookings.map(b => b.class_id));
    const seriesRemaining = cls.series_id
      ? classes.filter(c => c.series_id === cls.series_id && new Date(c.starts_at) >= new Date() && !bookedIds.has(c.id) && !c.cancelled).length
      : 0;
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 440 }}>
          <div className="modal-header"><h3>{t("Wybierz sposób płatności", "Choose payment method")}</h3><button className="modal-close" onClick={onClose}>×</button></div>
          <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
            <strong>{cls.name}</strong><br/>{formatDate(cls.starts_at)}, {formatTime(cls.starts_at)}{cls.price_pln ? ` · ${cls.price_pln} zł` : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div onClick={() => setMethod("cash")} style={{ border: `2px solid ${method === "cash" ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1rem", cursor: "pointer", background: method === "cash" ? "#EBF5EA" : "var(--warm-white)", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>💵</span>
                <div><div style={{ fontWeight: 500 }}>{t("Gotówka na miejscu", "Cash on site")}</div><div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{t("Płacisz gotówką w dniu zajęć", "Pay cash on the day of class")}</div></div>
              </div>
            </div>
            {tokensEnabled && (
            <div onClick={() => classEntries > 0 && setMethod("entries")} style={{ border: `2px solid ${method === "entries" ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1rem", cursor: classEntries > 0 ? "pointer" : "not-allowed", background: method === "entries" ? "#EBF5EA" : classEntries === 0 ? "var(--cream)" : "var(--warm-white)", opacity: classEntries === 0 ? 0.6 : 1, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎫</span>
                <div><div style={{ fontWeight: 500 }}>{t("Wejście z karnetu", "Use a credit")}</div><div style={{ fontSize: "0.8rem", color: classEntries > 0 ? "var(--sage-dark)" : "var(--clay)" }}>{classEntries > 0 ? t(`Masz ${classEntries} wejść na ${monthName(month)}`, `You have ${classEntries} credits for ${monthName(month)}`) : t(`Brak wejść na ${monthName(month)}`, `No credits for ${monthName(month)}`)}</div></div>
              </div>
            </div>
            )}
            {cls.price_pln > 0 && (
              <div onClick={() => setMethod("online")} style={{ border: `2px solid ${method === "online" ? "var(--sage)" : "var(--border)"}`, borderRadius: 10, padding: "1rem", cursor: "pointer", background: method === "online" ? "#EBF5EA" : "var(--warm-white)", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>💳</span>
                  <div><div style={{ fontWeight: 500 }}>{t("Płatność online", "Online payment")}</div><div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{t(`Karta, BLIK, przelew — ${cls.price_pln} zł`, `Card, transfer — ${cls.price_pln} zł`)}</div></div>
                </div>
              </div>
            )}
          </div>
          {tokensEnabled && method === "entries" && classEntries > 0 && <div style={{ background: "#FEF3E8", border: "1px solid #E8C5B5", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#8B5A2B" }}>⚠️ {t("Zapis zdejmie 1 wejście. Anulując przed 12:00 — wejście wraca.", "Booking will use 1 credit. Cancel before 12:00 to get it back.")}</div>}
          {method === "online" && <div style={{ background: "#EBF5EA", border: "1px solid var(--sage-light)", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", color: "var(--sage-dark)" }}>💳 {t("Zostaniesz przekierowany do bezpiecznej strony Przelewy24.", "You will be redirected to the secure Przelewy24 payment page.")}</div>}
          {cls.series_id && seriesRemaining > 1 && method !== "online" && (
            <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={bookSeries} onChange={e => setBookSeries(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--sage)", marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 500 }}>🔁 {t("Zapisz na całą serię", "Book the whole series")}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--mid)", marginTop: 2 }}>
                    {t(`Automatycznie zapisze Cię na ${seriesRemaining} nadchodzące zajęcia z tej serii`, `Automatically books you into ${seriesRemaining} upcoming classes in this series`)}
                  </div>
                </div>
              </label>
            </div>
          )}
          <button className="btn btn-primary btn-full"
            onClick={() => bookSeries ? handleBookSeries(cls.series_id, method) : handleBook(cls, method)}
            disabled={actionLoading === cls.id || actionLoading === "series" || (method === "entries" && classEntries === 0)}>
            {actionLoading === cls.id || actionLoading === "series"
              ? t("Zapisuję...", "Booking...")
              : bookSeries
                ? t(`Zapisz na ${seriesRemaining} zajęć z serii`, `Book ${seriesRemaining} classes in series`)
                : method === "online"
                  ? t(`Przejdź do płatności — ${cls.price_pln} zł`, `Go to payment — ${cls.price_pln} zł`)
                  : method === "entries" ? t("Zapisz i zdejmij wejście", "Book and use credit") : t("Zapisz (gotówka)", "Book (cash)")}
          </button>
        </div>
      </div>
    );
  }

  function CancelWarningModal({ booking, onClose }) {
    const cls = booking.classes;
    const loseEntry = booking.payment_method === "entries";
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="modal-header"><h3>{t("Uwaga — późne anulowanie", "Warning — late cancellation")}</h3><button className="modal-close" onClick={onClose}>×</button></div>
          <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.875rem", color: "#C44B4B", lineHeight: 1.6 }}>{t("Po 12:00 w dniu zajęć.", "After 12:00 on the day of class.")} {loseEntry ? <strong>{t("Stracisz 1 wejście.", "You will lose 1 credit.")}</strong> : t("Bez konsekwencji.", "No penalty.")}</p>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}><strong>{cls?.name}</strong><br/>{cls?.starts_at && formatDate(cls.starts_at)}</p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>{t("Nie anuluj", "Keep booking")}</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleCancel(booking, true)} disabled={actionLoading === booking.class_id}>
              {loseEntry ? t("Anuluj (stracę wejście)", "Cancel (lose credit)") : t("Anuluj", "Cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Push notifications
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  async function registerPush() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

      if (isIOS && !isInStandaloneMode) {
        showMsg("Na iPhone: dodaj aplikację do ekranu głównego przez Safari → 'Dodaj do ekranu początk.' — potem powiadomienia będą działać.", "error");
        return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showMsg(isIOS ? "Powiadomienia push wymagają iOS 16.4+ i dodania aplikacji do ekranu głównego." : "Twoja przeglądarka nie obsługuje powiadomień push.", "error");
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showMsg("Powiadomienia zablokowane — włącz je w ustawieniach przeglądarki.", "error");
        return;
      }

      // Utwórz subskrypcję Web Push
      if (VAPID_PUBLIC_KEY) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY,
        });
        // Zapisz subskrypcję — używamy Supabase client (autoryzacja przez sesję)
        const { error: saveError } = await supabase.from("profiles")
          .update({ push_subscription: JSON.stringify(sub.toJSON()) })
          .eq("id", session.user.id);
        if (saveError) console.error("Push subscription save error:", saveError.message);
      }

      setPushEnabled(true);
      showMsg("Powiadomienia push włączone! ✓");
    } catch (err) {
      showMsg("Błąd przy włączaniu powiadomień: " + err.message, "error");
    }
  }

  async function checkPushStatus() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg && Notification.permission === 'granted') {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setPushEnabled(true);
    }
  }

  async function savePhone() {
    setPhoneSaving(true);
    const phone = phoneInput.trim() || null;
    const { error } = await supabase.from("profiles").update({ phone }).eq("id", session.user.id);
    if (error) showMsg("Błąd zapisu: " + error.message, "error");
    else {
      onProfileUpdate({ phone });
      showMsg("Numer telefonu zapisany. ✓");
    }
    setPhoneSaving(false);
  }

  async function saveBirth() {
    setBirthSaving(true);
    const birth_date = birthInput || null;
    const { error } = await supabase.from("profiles").update({ birth_date }).eq("id", session.user.id);
    if (error) showMsg("Błąd zapisu: " + error.message, "error");
    else {
      onProfileUpdate({ birth_date });
      showMsg("Data urodzin zapisana. ✓");
    }
    setBirthSaving(false);
  }

  async function markNotificationsRead() {
    if (unreadCount === 0) return;
    await supabase.from("notifications").update({ read: true })
      .eq("user_id", session.user.id).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function notifIcon(type) {
    if (type === "class_cancelled") return "❌";
    if (type === "tokens_added") return "🎫";
    if (type === "birthday") return "🎂";
    return "📢";
  }

  function formatNotifDate(iso) {
    return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // Oceny zajęć
  function hasRated(classId) { return myRatings.some(r => r.class_id === classId); }
  function getRating(classId) { return myRatings.find(r => r.class_id === classId); }

  async function handleSubmitRating(cls) {
    const existing = getRating(cls.id);
    if (existing) {
      await supabase.from("class_ratings").update({ rating: ratingValue, comment: ratingComment }).eq("id", existing.id);
    } else {
      await supabase.from("class_ratings").insert({ class_id: cls.id, user_id: session.user.id, rating: ratingValue, comment: ratingComment, studio_id: studioId });
    }
    showMsg("Dziękujemy za ocenę! ✓");
    setShowRatingModal(null);
    setRatingValue(5);
    setRatingComment("");
    const { data } = await supabase.from("class_ratings").select("*").eq("user_id", session.user.id);
    setMyRatings(data || []);
  }

  function googleCalendarUrl(cls) {
    const start = new Date(cls.starts_at);
    const end = new Date(start.getTime() + cls.duration_min * 60000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${studioName} — ${cls.name}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: cls.notes || "Zajęcia pilates",
      location: cls.location || studioName,
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  function appleCalendarUrl(cls) {
    const start = new Date(cls.starts_at);
    const end = new Date(start.getTime() + cls.duration_min * 60000);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Pilates — ${cls.name}`,
      `DESCRIPTION:${cls.notes || "Zajęcia pilates"}`,
      `LOCATION:${cls.location || studioName}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    return `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
  }

  function DetailModal({ cls, onClose }) {
    if (!cls) return null;
    const booked = isBooked(cls.id);
    const booking = getBooking(cls.id);
    const onWaitlist = isOnWaitlist(cls.id);
    const count = getBookedCount(cls);
    const isFull = count >= cls.max_spots;
    const fillPct = Math.min((count / cls.max_spots) * 100, 100);
    const status = booked ? cancelStatus(cls.starts_at) : null;
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-header"><h3>{cls.name}</h3><button className="modal-close" onClick={onClose}>×</button></div>
          <div style={{ marginBottom: "1.25rem" }}>
            {booked ? <span className="class-badge badge-yours">{t("Zapisano", "Booked")} · {booking?.payment_method === "entries" ? "🎫" : "💵"}</span>
              : onWaitlist ? <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>{t("W kolejce", "Waitlisted")}</span>
              : isFull ? <span className="class-badge badge-full">{t("Brak miejsc", "Full")}</span>
              : <span className="class-badge badge-open">{t("Wolne miejsca", "Spots available")}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
            {[{ icon: "📅", label: t("Data", "Date"), val: formatDate(cls.starts_at) }, { icon: "🕐", label: t("Godzina", "Time"), val: `${formatTime(cls.starts_at)} · ${cls.duration_min} min` }, cls.location && { icon: "📍", label: t("Lokalizacja", "Location"), val: cls.location, maps: true }, cls.price_pln && { icon: "💰", label: t("Cena", "Price"), val: `${cls.price_pln} zł` }].filter(Boolean).map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {item.val}
                    {item.maps && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.val)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.7rem", color: "var(--sage-dark)", textDecoration: "none", border: "1px solid var(--sage)", borderRadius: 10, padding: "0.1rem 0.45rem", whiteSpace: "nowrap" }}>Nawiguj →</a>}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>👥</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("Dostępność", "Availability")}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>{count} / {cls.max_spots} {t("miejsc", "spots")}</div>
                <div className="spots-bar" style={{ marginTop: "0.4rem" }}><div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} /></div>
              </div>
            </div>
          </div>
          {cls.notes && <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>📌 {t("Informacje dodatkowe", "Additional info")}</div>
            <p style={{ fontSize: "0.9rem", color: "var(--charcoal)", lineHeight: 1.6 }}>{cls.notes}</p>
          </div>}
          {booked ? (
            <>
              {status === "past"
                ? <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", fontSize: "0.875rem", color: "var(--mid)", textAlign: "center" }}>✓ {t("Zajęcia odbyły się", "Class completed")}</div>
                : <>
                    {status === "after_cutoff" && <div style={{ background: "#FEF3E8", border: "1px solid #E8C5B5", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem", fontSize: "0.8rem", color: "#8B5A2B" }}>⚠️ {t("Po 12:00", "After 12:00")} — {booking?.payment_method === "entries" ? t("stracisz wejście", "you'll lose a credit") : t("bez konsekwencji", "no penalty")}.</div>}
                    <button className="btn btn-danger btn-full" onClick={() => handleCancel(booking)} disabled={actionLoading === cls.id}>{actionLoading === cls.id ? "..." : t("Anuluj rezerwację", "Cancel booking")}</button>
                  </>
              }
              {status !== "past" && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <a href={googleCalendarUrl(cls)} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.8rem", color: "var(--mid)", textDecoration: "none", background: "var(--warm-white)" }}>
                    📅 Google Calendar
                  </a>
                  <a href={appleCalendarUrl(cls)} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.8rem", color: "var(--mid)", textDecoration: "none", background: "var(--warm-white)" }}>
                    🍎 Apple Calendar
                  </a>
                </div>
              )}
            </>
          ) : onWaitlist ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleLeaveWaitlist(cls)}>{actionLoading === cls.id ? "..." : t("Wypisz się z kolejki", "Leave waitlist")}</button>
          ) : isFull ? (
            <button className="btn btn-secondary btn-full" onClick={() => handleJoinWaitlist(cls)}>{actionLoading === cls.id ? "..." : t("Dołącz do kolejki", "Join waitlist")}</button>
          ) : (
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); setShowBookModal(cls); }}>{t("Zapisz się →", "Sign up →")}</button>
          )}
        </div>
      </div>
    );
  }

  function NotifFilters({ notifications, filter, setFilter }) {
    const unread = notifications.filter(n => !n.read).length;
    const filters = [
      { key: "all", label: t("Wszystkie", "All") },
      { key: "unread", label: `${t("Nieprzeczytane", "Unread")}${unread > 0 ? ` (${unread})` : ""}` },
      { key: "class_cancelled", label: t("Odwołania", "Cancellations") },
      { key: "booking", label: t("Wiadomości", "Messages") },
      { key: "tokens_added", label: t("Wejścia", "Credits") },
    ];
    return (
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`btn btn-sm ${filter === f.key ? "btn-primary" : "btn-secondary"}`}>
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => setTab("upcoming")} style={{ cursor: "pointer" }}>
          {studio?.branding?.logo_url
            ? <img src={studio.branding.logo_url} alt={studioName} style={{ maxHeight: 48, maxWidth: "100%", objectFit: "contain" }} />
            : <h1>{studioName}</h1>}
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}><span className="nav-icon">🗓</span> {classLabel}</div>
          <div className={`nav-item ${tab === "my" ? "active" : ""}`} onClick={() => setTab("my")}><span className="nav-icon">✦</span> {t("Moje rezerwacje", "My bookings")}</div>
          <div className={`nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { setTab("notifications"); markNotificationsRead(); }} style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}><span className="nav-icon">🔔</span> {t("Powiadomienia", "Notifications")}</span>
            {unreadCount > 0 && <span style={{ background: "var(--clay)", color: "white", borderRadius: 20, fontSize: "0.7rem", padding: "0.1rem 0.45rem", fontWeight: 600 }}>{unreadCount}</span>}
          </div>
          <div className={`nav-item ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}><span className="nav-icon">👤</span> {t("Moje konto", "My account")}</div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
            <div><div className="user-name">{profile?.first_name} {profile?.last_name}</div><div className="user-role">{t("Klient", "Client")}</div></div>
          </div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>{t("Wyloguj się", "Log out")}</button>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={() => setDarkMode(!darkMode)}
              style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.5rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.8rem" }}>
              {darkMode ? t("☀️ Jasny", "☀️ Light") : t("🌙 Ciemny", "🌙 Dark")}
            </button>
            {isMultilingual && (
              <button onClick={() => setLang(lang === "pl" ? "en" : "pl")}
                style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.5rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.8rem" }}>
                {lang === "pl" ? "🇬🇧 EN" : "🇵🇱 PL"}
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main-content">
        {message && <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`} style={{ position: "fixed", top: "1rem", right: "1rem", left: "1rem", zIndex: 999, maxWidth: 420, margin: "0 auto" }}>{message.text}</div>}

        {tab === "upcoming" && (
          <>
            {/* Nagłówek z przełącznikiem widoku */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div className="page-header" style={{ margin: 0 }}>
                <h2>{hasServices ? t("Nadchodzące wizyty", "Upcoming appointments") : t("Nadchodzące zajęcia", "Upcoming classes")}</h2>
                <p>{hasServices ? t("Kliknij wizytę, aby się zapisać", "Click an appointment to book") : t("Kliknij w zajęcia, aby się zapisać", "Click a class to sign up")}</p>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button className={`btn btn-sm ${viewMode === "calendar" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("calendar")}>📅 {t("Kalendarz", "Calendar")}</button>
                <button className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`} onClick={() => setViewMode("list")}>☰ {t("Lista", "List")}</button>
              </div>
            </div>

            {currentTokens && currentTokens.amount > 0 && (
              <div className="card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎫</span>
                <div><div style={{ fontWeight: 500 }}>{t("Wejścia w tym miesiącu:", "Credits this month:")} <strong style={{ color: "var(--sage-dark)" }}>{currentTokens.amount}</strong></div><div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{t("Możesz użyć wejść przy zapisie", "You can use credits when booking")}</div></div>
              </div>
            )}

            {loading ? <div className="empty-state"><p>{t("Ładowanie...", "Loading...")}</p></div>
              : upcomingClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>{t("Brak nadchodzących zajęć.", "No upcoming classes.")}</p></div>
              : viewMode === "calendar" ? (
                /* WIDOK KALENDARZA */
                <div>
                  {/* === MOBILNY WIDOK 4-DNI === */}
                  {(() => {
                    const DAYS = 4;
                    const days = Array.from({ length: DAYS }, (_, i) => {
                      const d = new Date(mobileCalStart);
                      d.setDate(d.getDate() + i);
                      return d;
                    });
                    const rangeLabel = (() => {
                      const s = days[0], e = days[DAYS - 1];
                      if (s.getMonth() === e.getMonth())
                        return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString(locale, { month: "long" })}`;
                      return `${s.getDate()} ${s.toLocaleDateString(locale,{month:"short"})} – ${e.getDate()} ${e.toLocaleDateString(locale,{month:"short"})}`;
                    })();
                    const shiftDays = (n) => {
                      const d = new Date(mobileCalStart);
                      d.setDate(d.getDate() + n);
                      setMobileCalStart(d);
                    };
                    return (
                      <div className="cal-mobile">
                        <div className="cal-mobile-nav">
                          <button className="btn btn-secondary btn-sm" onClick={() => shiftDays(-DAYS)}>←</button>
                          <span className="cal-mobile-range">{rangeLabel}</span>
                          <button className="btn btn-secondary btn-sm" onClick={() => shiftDays(DAYS)}>→</button>
                        </div>
                        <div className="cal-mobile-grid">
                          {days.map((day, di) => {
                            const isToday = day.toDateString() === new Date().toDateString();
                            const dayClasses = classes.filter(c => new Date(c.starts_at).toDateString() === day.toDateString());
                            const dayName = day.toLocaleDateString(locale, { weekday: "short" });
                            return (
                              <div key={di} className={`cal-mobile-col${isToday ? " today" : ""}`}>
                                <div className="cal-mobile-col-head">
                                  <span className="cal-mobile-dayname">{dayName}</span>
                                  <span className="cal-mobile-daynum">{day.getDate()}</span>
                                </div>
                                <div className="cal-mobile-chips">
                                  {dayClasses.length === 0
                                    ? <div className="cal-mobile-empty">·</div>
                                    : dayClasses.map(cls => {
                                        const booked = isBooked(cls.id);
                                        const onWaitlist = isOnWaitlist(cls.id);
                                        const isFull = getBookedCount(cls) >= cls.max_spots;
                                        const chipCls = booked ? "chip-booked" : onWaitlist ? "chip-waitlist" : isFull ? "chip-full" : "chip-open";
                                        return (
                                          <div key={cls.id} className={`cal-mobile-chip ${chipCls}`} onClick={() => setDetailClass(cls)}>
                                            <span className="chip-time">{new Date(cls.starts_at).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</span>
                                            <span className="chip-name">{cls.name}</span>
                                          </div>
                                        );
                                      })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="cal-mobile-legend">
                          {[["chip-booked",t("Moje","Mine")],["chip-waitlist",t("Kolejka","Queue")],["chip-full",t("Brak","Full")],["chip-open",t("Wolne","Open")]].map(([cls,label]) => (
                            <div key={label} className="cal-legend-item"><span className={`cal-legend-dot ${cls}`} />{label}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* === DESKTOPOWY KALENDARZ MIESIĘCZNY === */}
                  <div className="cal-desktop">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(calendarWeek); d.setMonth(d.getMonth() - 1); d.setDate(1); setCalendarWeek(d); }}>← {t("Poprzedni", "Prev")}</button>
                    <span style={{ fontWeight: 500, fontSize: "1rem" }}>{calendarWeek.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(calendarWeek); d.setMonth(d.getMonth() + 1); d.setDate(1); setCalendarWeek(d); }}>{t("Następny", "Next")} →</button>
                  </div>
                  {(() => {
                    const year = calendarWeek.getFullYear();
                    const month = calendarWeek.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const mDayNames = lang === "en" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"];
                    let startOffset = firstDay.getDay() - 1;
                    if (startOffset < 0) startOffset = 6;
                    const cells = [];
                    for (let i = 0; i < startOffset; i++) cells.push(null);
                    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
                    while (cells.length % 7 !== 0) cells.push(null);
                    return (
                      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--warm-white)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                          {mDayNames.map(d => <div key={d} style={{ padding: "0.6rem 0.25rem", textAlign: "center", background: "var(--cream)", fontSize: "0.75rem", fontWeight: 500, color: "var(--mid)", textTransform: "uppercase" }}>{d}</div>)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                          {cells.map((day, i) => {
                            if (!day) return <div key={i} style={{ minHeight: 80, background: "var(--cream)", opacity: 0.3, borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)" }} />;
                            const dayClasses = classes.filter(cls => new Date(cls.starts_at).toDateString() === day.toDateString());
                            const today = day.toDateString() === new Date().toDateString();
                            return (
                              <div key={i} style={{ minHeight: 80, padding: "0.3rem", borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)", background: today?"rgba(138,158,133,0.06)":"transparent" }}>
                                <div style={{ fontSize: "0.8rem", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: today?"var(--sage)":"transparent", color: today?"white":"var(--charcoal)", marginBottom: "0.2rem", fontWeight: today?600:400 }}>{day.getDate()}</div>
                                {dayClasses.map(cls => {
                                  const booked = isBooked(cls.id);
                                  const onWaitlist = isOnWaitlist(cls.id);
                                  const count = getBookedCount(cls);
                                  const isFull = count >= cls.max_spots;
                                  const bg = booked?"#EBF5EA":onWaitlist?"#FEF3E8":isFull?"#FDE8E8":"var(--cream)";
                                  const color = booked?"#5C7A56":onWaitlist?"#B87333":isFull?"#C44B4B":"var(--charcoal)";
                                  const border = booked?"#8A9E85":onWaitlist?"#E8C5B5":isFull?"#F5C6C6":"var(--border)";
                                  return (
                                    <div key={cls.id} onClick={() => setDetailClass(cls)}
                                      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: "0.2rem 0.35rem", marginBottom: "0.2rem", cursor: "pointer" }}
                                      onMouseEnter={e => e.currentTarget.style.opacity="0.75"}
                                      onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                                      <div style={{ fontSize: "0.68rem", fontWeight: 500, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{new Date(cls.starts_at).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})} {cls.name}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                    {[["#EBF5EA","#8A9E85",t("Moje zajęcia","My classes")],["#FEF3E8","#E8C5B5",t("W kolejce","Waitlisted")],["#FDE8E8","#F5C6C6",t("Brak miejsc","Full")],["var(--cream)","var(--border)",t("Wolne miejsca","Available")]].map(([bg,border,label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--mid)" }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
                        {label}
                      </div>
                    ))}
                  </div>
                  </div>{/* /cal-desktop */}
                </div>
              ) : (
                /* WIDOK LISTY — grupowany po dniach */
                (() => {
                  const byDay = upcomingClasses.reduce((acc, cls) => {
                    const key = new Date(cls.starts_at).toDateString();
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(cls);
                    return acc;
                  }, {});
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                      {Object.entries(byDay).map(([dayKey, dayCls]) => {
                        const dayDate = new Date(dayCls[0].starts_at);
                        const isToday = dayDate.toDateString() === new Date().toDateString();
                        const dayLabel = dayDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
                        return (
                          <div key={dayKey}>
                            <div className="day-section-header">
                              <span className="day-section-label">{dayLabel}</span>
                              {isToday && <span className="day-section-today">{t("dzisiaj", "today")}</span>}
                            </div>
                            <div className="classes-day-list">
                              {dayCls.map(cls => {
                                const booked = isBooked(cls.id);
                                const booking = getBooking(cls.id);
                                const onWaitlist = isOnWaitlist(cls.id);
                                const count = getBookedCount(cls);
                                const waitlistCount = cls.waitlist?.length || 0;
                                const isFull = count >= cls.max_spots;
                                const fillPct = Math.min((count / cls.max_spots) * 100, 100);
                                const statusColor = booked ? "var(--sage)" : onWaitlist ? "#B87333" : isFull ? "#C44B4B" : "var(--mid)";
                                return (
                                  <div className="class-row-card" key={cls.id} onClick={() => setDetailClass(cls)}
                                    style={{ borderLeft: `3px solid ${statusColor}` }}>
                                    <div className="class-row-time">
                                      <span className="class-row-hour">{formatTime(cls.starts_at)}</span>
                                      <span className="class-row-dur">{cls.duration_min} min</span>
                                    </div>
                                    <div className="class-row-info">
                                      <div className="class-row-name">{cls.name}</div>
                                      <div className="class-row-meta">
                                        {cls.location && <span>📍 {cls.location} <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cls.location)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "var(--sage-dark)", textDecoration: "none", fontSize: "0.7rem", border: "1px solid var(--sage)", borderRadius: 10, padding: "0.05rem 0.4rem" }}>↗</a></span>}
                                        {cls.price_pln ? <span>💰 {cls.price_pln} zł</span> : null}
                                        <span style={{ color: isFull ? "#C44B4B" : "inherit" }}>
                                          {count}/{cls.max_spots} {t("miejsc", "spots")}{waitlistCount > 0 && ` · ${waitlistCount} ${t("w kolejce", "waitlisted")}`}
                                        </span>
                                      </div>
                                      {cls.notes && <div className="class-row-note">📌 {cls.notes.length > 60 ? cls.notes.slice(0, 60) + "…" : cls.notes}</div>}
                                      <div className="spots-bar" style={{ marginTop: "0.5rem" }}>
                                        <div className={`spots-fill ${isFull ? "full" : fillPct >= 80 ? "almost-full" : ""}`} style={{ width: `${fillPct}%` }} />
                                      </div>
                                    </div>
                                    <div className="class-row-status">
                                      {booked
                                        ? <span className="class-badge badge-yours">{booking?.payment_method === "entries" ? "🎫" : "💵"} {t("Zapisano", "Booked")}</span>
                                        : onWaitlist ? <span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>{t("Kolejka", "Queue")}</span>
                                        : isFull ? <span className="class-badge badge-full">{t("Brak", "Full")}</span>
                                        : <span className="class-badge badge-open">{t("Wolne", "Open")}</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
          </>
        )}

        {tab === "my" && (
          <>
            <div className="page-header"><h2>{t("Moje rezerwacje", "My bookings")}</h2></div>
            {upcomingMyClasses.length === 0
              ? <div className="empty-state"><div className="empty-icon">✦</div><p>{t("Brak nadchodzących rezerwacji.", "No upcoming bookings.")}</p></div>
              : <div className="cards-grid">{upcomingMyClasses.map(b => {
                const status = cancelStatus(b.classes?.starts_at);
                return (
                  <div className="class-card" key={b.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(classes.find(c => c.id === b.class_id) || b.classes)}>
                    <div className="class-card-header">
                      <span className="class-title">{b.classes?.name}</span>
                      <span className="class-badge badge-yours">{b.payment_method === "entries" ? `🎫 ${t("wejście","credit")}` : `💵 ${t("gotówka","cash")}`}</span>
                    </div>
                    <div className="class-card-body">
                      <div className="class-meta">
                        <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(b.classes?.starts_at)}</div>
                        <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(b.classes?.starts_at)} · {b.classes?.duration_min} min</div>
                      </div>
                      {status === "after_cutoff" && <p style={{ fontSize: "0.75rem", color: "var(--clay)", marginTop: "0.5rem" }}>⚠️ {t("Po 12:00 — anulowanie bez zwrotu", "After 12:00 — cancellation without refund")}</p>}
                      <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>{t("Kliknij, aby zobaczyć szczegóły →", "Click to see details →")}</p>
                    </div>
                  </div>
                );
              })}</div>}
            {myWaitlist.length > 0 && (
              <>
                <div className="page-header" style={{ marginTop: "2rem" }}><h2>{t("Lista oczekujących", "Waitlist")}</h2></div>
                <div className="cards-grid">{myWaitlist.map(w => (
                  <div className="class-card" key={w.id} style={{ cursor: "pointer" }} onClick={() => setDetailClass(w.classes)}>
                    <div className="class-card-header"><span className="class-title">{w.classes?.name}</span><span className="class-badge" style={{ background: "#FEF3E8", color: "#B87333" }}>{t("W kolejce", "Waitlisted")}</span></div>
                    <div className="class-card-body">
                      <div className="class-meta">
                        <div className="meta-item"><span className="meta-icon">📅</span>{formatDate(w.classes?.starts_at)}</div>
                        <div className="meta-item"><span className="meta-icon">🕐</span>{formatTime(w.classes?.starts_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}</div>
              </>
            )}
          </>
        )}

        {tab === "account" && (
          <>
            <div className="page-header"><h2>{t("Moje konto", "My account")}</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
              <div className="card">
                <div className="user-info" style={{ marginBottom: "1.5rem" }}>
                  <div className="user-avatar" style={{ width: 56, height: 56, fontSize: "1.5rem" }}>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
                  <div><div className="user-name" style={{ fontSize: "1.1rem" }}>{profile?.first_name} {profile?.last_name}</div><div className="user-role">{profile?.email}</div></div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ flex: 1, background: "var(--cream)", borderRadius: 8, padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--sage-dark)" }}>{myBookings.length}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--mid)", textTransform: "uppercase" }}>{t("Wszystkich", "Total")}</div>
                  </div>
                  <div style={{ flex: 1, background: "var(--cream)", borderRadius: 8, padding: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--sage-dark)" }}>{pastMyClasses.length}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--mid)", textTransform: "uppercase" }}>{t("Ukończonych", "Completed")}</div>
                  </div>
                </div>
                <button onClick={() => setDarkMode(!darkMode)} className="btn btn-secondary btn-full" style={{ marginBottom: "0.75rem" }}>
                  {darkMode ? t("☀️ Tryb jasny", "☀️ Light mode") : t("🌙 Tryb ciemny", "🌙 Dark mode")}
                </button>
                <button className="btn btn-danger btn-full" onClick={() => supabase.auth.signOut()}>{t("Wyloguj się", "Log out")}</button>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1.3rem" }}>📱 {t("Powiadomienia SMS", "SMS Notifications")}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--mid)", marginBottom: "1rem", lineHeight: 1.6 }}>
                  {t("Podaj numer, aby otrzymywać SMS-y o odwołanych zajęciach, awansie z kolejki i przypomnieniach dzień przed zajęciami.", "Enter your number to receive SMS about cancelled classes, waitlist promotions and day-before reminders.")}
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="+48 500 000 000"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={savePhone} disabled={phoneSaving}>
                    {phoneSaving ? "..." : t("Zapisz", "Save")}
                  </button>
                </div>
                {phoneInput && <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>✓ {t("SMS-y aktywne", "SMS active")}</p>}
              </div>
              <div className="card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1.3rem" }}>🎂 {t("Data urodzin", "Birthday")}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--mid)", marginBottom: "1rem", lineHeight: 1.6 }}>
                  {t("Podaj datę urodzin, aby otrzymać życzenia w swoim dniu.", "Enter your birthday to receive wishes on your special day.")}
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    className="form-input"
                    type="date"
                    value={birthInput}
                    onChange={e => setBirthInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={saveBirth} disabled={birthSaving}>
                    {birthSaving ? "..." : t("Zapisz", "Save")}
                  </button>
                </div>
                {birthInput && <p style={{ fontSize: "0.75rem", color: "var(--sage-dark)", marginTop: "0.5rem" }}>✓ {t("Aktywne", "Active")}</p>}
              </div>
              {tokensEnabled && (
              <div className="card">
                <h3 style={{ marginBottom: "1rem", fontSize: "1.3rem" }}>🎫 {t("Moje wejścia", "My credits")}</h3>
                {myTokens.length === 0
                  ? <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>{t(`Brak wejść. Skontaktuj się z ${studioName}.`, `No credits. Contact ${studioName}.`)}</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {myTokens.map(tok => (
                      <div key={tok.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--mid)", fontSize: "0.875rem" }}>{monthName(tok.month)} {tok.year}</span>
                        <span style={{ fontWeight: 600, color: tok.amount > 0 ? "var(--sage-dark)" : "var(--light)", fontSize: "1.1rem" }}>{tok.amount} {lang === "en" ? (tok.amount === 1 ? "credit" : "credits") : (tok.amount === 1 ? "wejście" : tok.amount < 5 ? "wejścia" : "wejść")}</span>
                      </div>
                    ))}
                  </div>}
                <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--light)" }}>{t("Anuluj przed 12:00 w dniu zajęć aby odzyskać wejście.", "Cancel before 12:00 on the day of class to get your credit back.")}</p>
              </div>
              )}
            </div>
            <div className="section-header" style={{ marginBottom: "1rem" }}>
              <h3>{t("Historia moich zajęć", "Class history")}</h3>
              <span style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{pastMyClasses.length} {t("zajęć", "classes")}</span>
            </div>
            {/* Powiadomienia push */}
            {(() => {
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
              const iosNotReady = isIOS && !isStandalone;
              return (
                <div className="card" style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>🔔</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{pushEnabled ? t("Powiadomienia włączone", "Notifications enabled") : t("Powiadomienia push", "Push notifications")}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>
                          {pushEnabled ? t("Otrzymasz powiadomienia o zajęciach", "You'll receive class notifications") : iosNotReady ? t("Wymaga dodania do ekranu głównego", "Requires adding to home screen") : t("Włącz aby dostawać powiadomienia na telefon", "Enable to get notifications on your phone")}
                        </div>
                      </div>
                    </div>
                    {pushEnabled
                      ? <span style={{ color: "var(--sage-dark)", fontSize: "0.875rem", fontWeight: 500 }}>✅ {t("Aktywne", "Active")}</span>
                      : <button className="btn btn-primary btn-sm" onClick={registerPush}>{t("Włącz", "Enable")}</button>}
                  </div>
                  {iosNotReady && !pushEnabled && (
                    <div style={{ marginTop: "0.75rem", background: "#FEF3E8", border: "1px solid #E8C5B5", borderRadius: 8, padding: "0.75rem", fontSize: "0.8rem", color: "#8B5A2B" }}>
                      📱 Na iPhone: otwórz w Safari → kliknij <strong>□↑</strong> → <strong>"Dodaj do ekranu głównego"</strong> → otwórz aplikację stamtąd
                    </div>
                  )}
                </div>
              );
            })()}

            {pastMyClasses.length === 0
              ? <div className="empty-state"><div className="empty-icon">🌿</div><p>{t("Brak historii zajęć.", "No class history.")}</p></div>
              : <div className="table-wrapper"><table>
                <thead><tr><th>{t("Zajęcia","Class")}</th><th>{t("Data","Date")}</th><th>{t("Godzina","Time")}</th><th>{t("Płatność","Payment")}</th><th>{t("Cena","Price")}</th><th>{t("Ocena","Rating")}</th></tr></thead>
                <tbody>{pastMyClasses.map(b => {
                  const rated = getRating(b.class_id);
                  return (
                  <tr key={b.id}>
                    <td><strong>{b.classes?.name}</strong></td>
                    <td>{formatDateShort(b.classes?.starts_at)}</td>
                    <td>{formatTime(b.classes?.starts_at)}</td>
                    <td>{b.payment_method === "entries" ? "🎫" : "💵"}</td>
                    <td>{b.classes?.price_pln ? `${b.classes.price_pln} zł` : "—"}</td>
                    <td>
                      {rated
                        ? <span style={{ cursor: "pointer", fontSize: "0.85rem" }} onClick={() => { setShowRatingModal(b.classes); setRatingValue(rated.rating); setRatingComment(rated.comment || ""); }}>{"⭐".repeat(rated.rating)}</span>
                        : <button className="btn btn-secondary btn-sm" onClick={() => { setShowRatingModal(b.classes); setRatingValue(5); setRatingComment(""); }}>{t("Oceń", "Rate")}</button>}
                    </td>
                  </tr>
                  );
                })}</tbody></table></div>}
          </>
        )}
        {tab === "notifications" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div className="page-header" style={{ margin: 0 }}><h2>{t("Powiadomienia", "Notifications")}</h2></div>
              <NotifFilters notifications={notifications} filter={notifFilter} setFilter={setNotifFilter} />
            </div>
            {(() => {
              const filtered = notifications.filter(n =>
                notifFilter === "unread" ? !n.read :
                notifFilter === "class_cancelled" ? n.type === "class_cancelled" :
                notifFilter === "tokens_added" ? n.type === "tokens_added" :
                notifFilter === "booking" ? n.type === "booking" :
                true
              );
              return filtered.length === 0
                ? <div className="empty-state"><div className="empty-icon">🔔</div><p>{t("Brak powiadomień", "No notifications")}{notifFilter !== "all" ? t(" w tej kategorii", " in this category") : ""}.</p></div>
                : <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 600 }}>
                    {filtered.map(n => (
                      <div key={n.id} className="card" style={{ display: "flex", gap: "1rem", alignItems: "flex-start", opacity: n.read ? 0.65 : 1, borderLeft: n.read ? "3px solid var(--border)" : "3px solid var(--sage)" }}>
                        <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>{notifIcon(n.type)}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "0.875rem", color: "var(--charcoal)", lineHeight: 1.6 }}>{n.message}</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--light)", marginTop: "0.3rem" }}>{formatNotifDate(n.created_at)}</p>
                        </div>
                        {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sage)", flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    ))}
                  </div>;
            })()}
          </>
        )}
      </main>

      {detailClass && <DetailModal cls={detailClass} onClose={() => setDetailClass(null)} />}
      {showBookModal && <BookModal cls={showBookModal} onClose={() => setShowBookModal(null)} />}
      {showCancelWarning && <CancelWarningModal booking={showCancelWarning} onClose={() => setShowCancelWarning(null)} />}

      {/* Modal oceny zajęć */}
      {showRatingModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRatingModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{t("Oceń zajęcia", "Rate this class")}</h3>
              <button className="modal-close" onClick={() => setShowRatingModal(null)}>×</button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
              <strong>{showRatingModal?.name}</strong><br/>
              {showRatingModal?.starts_at && formatDate(showRatingModal.starts_at)}
            </p>
            <div style={{ marginBottom: "1.25rem" }}>
              <label className="form-label">{t("Twoja ocena", "Your rating")}</label>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setRatingValue(star)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "2rem", opacity: star <= ratingValue ? 1 : 0.3, transition: "opacity 0.15s" }}>
                    ⭐
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--mid)", marginTop: "0.4rem" }}>
                {lang === "en"
                  ? ["","Poor","Below expectations","OK","Very good","Excellent!"][ratingValue]
                  : ["","Słabe","Poniżej oczekiwań","W porządku","Bardzo dobre","Doskonałe!"][ratingValue]}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">{t("Komentarz (opcjonalnie)", "Comment (optional)")}</label>
              <textarea className="form-input" rows={3} placeholder={t("Co Ci się podobało? Co można poprawić?", "What did you like? What could be improved?")}
                value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                style={{ resize: "none" }} />
            </div>
            <button className="btn btn-primary btn-full" onClick={() => handleSubmitRating(showRatingModal)}>
              {t("Wyślij ocenę ⭐", "Submit rating ⭐")}
            </button>
          </div>
        </div>
      )}

      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}><span className="mobile-nav-icon">🗓</span><span>{classLabel}</span></div>
        <div className={`mobile-nav-item ${tab === "my" ? "active" : ""}`} onClick={() => setTab("my")}><span className="mobile-nav-icon">✦</span><span>{t("Rezerwacje", "Bookings")}</span></div>
        <div className={`mobile-nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { setTab("notifications"); markNotificationsRead(); }} style={{ position: "relative" }}>
          <span className="mobile-nav-icon">🔔</span>
          {unreadCount > 0 && <span style={{ position: "absolute", top: 6, right: "50%", marginRight: -18, background: "var(--clay)", color: "white", borderRadius: 20, fontSize: "0.6rem", padding: "0.05rem 0.35rem", fontWeight: 600, minWidth: 16, textAlign: "center" }}>{unreadCount}</span>}
          <span>{t("Powiad.", "Notif.")}</span>
        </div>
        <div className={`mobile-nav-item ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}><span className="mobile-nav-icon">👤</span><span>{t("Konto", "Account")}</span></div>
      </nav>
    </div>
  );
}
