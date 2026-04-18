import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { useStudio } from "../StudioContext";
import { useT, useLang, useSetLang } from "../LanguageContext";
import { sendEmail, formatEmailDate, formatEmailTime, monthNamePL } from "../emailService";
import { sendSms, smsDate } from "../smsService";

export default function AdminDashboard({ session, profile, studioId, darkMode, setDarkMode }) {
  const { studio } = useStudio();
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const locale = lang === "en" ? "en-GB" : "pl-PL";
  const isMultilingual = studio?.slug === "demo" || studio?.features?.multilingual === true;
  const studioName = studio?.name || "Studio";
  const smsSig = studio?.branding?.sms_signature || studioName;
  const isDemo = studio?.features?.is_demo === true;
  const tokensEnabled = studio?.features?.tokens_enabled !== false;
  const serviceMode = studio?.features?.service_mode || "classes";
  const hasServices = serviceMode === "services";
  const multiStaff = hasServices && studio?.features?.multi_staff === true;
  const classLabel = hasServices ? t("Wizyty", "Appointments") : t("Zajęcia", "Classes");
  const [tab, setTab] = useState("classes");
  const [classes, setClasses] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(null);
  const [editClass, setEditClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [userTokens, setUserTokens] = useState([]);
  const [userTokenHistory, setUserTokenHistory] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState({ totalClasses: 0, totalBookings: 0, uniqueClients: 0 });
  const [form, setForm] = useState({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "", staff_id: "" });
  const [recurring, setRecurring] = useState({ enabled: false, weeks: 4 });
  const [tokenForm, setTokenForm] = useState({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [messageText, setMessageText] = useState("");
  const [msgDelivery, setMsgDelivery] = useState({ app: true, email: false, sms: false });
  const [notifFilter, setNotifFilter] = useState("all");
  const [message, setMessage] = useState(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportView, setReportView] = useState("summary");
  const [clientSearch, setClientSearch] = useState("");
  const [editingNotes, setEditingNotes] = useState(null); // userId
  const [notesText, setNotesText] = useState("");
  const [adminCalendarWeek, setAdminCalendarWeek] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
  const [classRatings, setClassRatings] = useState([]);
  const [editSeriesAll, setEditSeriesAll] = useState(false);
  const [bulkMsgText, setBulkMsgText] = useState("");
  const [bulkMsgTarget, setBulkMsgTarget] = useState("all");
  const [bulkMsgTargetClass, setBulkMsgTargetClass] = useState("");
  const [bulkMsgChannels, setBulkMsgChannels] = useState({ app: true, push: false, sms: false });
  const [sendingBulk, setSendingBulk] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({ first_name: "", last_name: "", phone: "", birth_date: "", role: "client" });
  const [renamingVenue, setRenamingVenue] = useState(null);
  const [renameVenueTo, setRenameVenueTo] = useState("");
  const [addParticipantId, setAddParticipantId] = useState("");
  const [addParticipantMethod, setAddParticipantMethod] = useState("cash");
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ first_name: "", last_name: "", email: "", phone: "", birth_date: "" });
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [newClientContext, setNewClientContext] = useState("clients");
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", color: "#8A9E85" });
  const [editingStaff, setEditingStaff] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState({ name: "", duration_min: 60, price_pln: "" });
  const [editingService, setEditingService] = useState(null);
  const [staffCalDay, setStaffCalDay] = useState(new Date());
  const [studioSettings, setStudioSettings] = useState(null);
  const [studioSettingsSaving, setStudioSettingsSaving] = useState(false);
  const [studioLogoFile, setStudioLogoFile] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);


  useEffect(() => { if (studioId) fetchAll(); }, [studioId]);

  useEffect(() => {
    if (!studio) return;
    const b = studio.branding || {};
    const f = studio.features || {};
    setStudioSettings({
      name: studio.name || "",
      nav_name: b.nav_name || "",
      hero_eyebrow: b.hero_eyebrow || "",
      hero_title: b.hero_title || "",
      hero_sub: b.hero_sub || "",
      cta_title: b.cta_title || "",
      cta_sub: b.cta_sub || "",
      email_from: b.email_from || "",
      app_url: b.app_url || "",
      sms_signature: b.sms_signature || "",
      logo_url: b.logo_url || "",
      color_sage: b.colors?.sage || "#8A9E85",
      color_clay: b.colors?.clay || "#C4917A",
      color_cream: b.colors?.cream || "#F7F3EE",
      tokens_enabled: f.tokens_enabled !== false,
      multi_staff: f.multi_staff === true,
      service_mode: f.service_mode || "classes",
      payments_online: f.payments_online === true,
      payment_provider: f.payment_provider || "p24",
    });
  }, [studio]);

  function showMsg(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function fetchAll() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data: classData } = await supabase.from("classes")
      .select("*, bookings(*, profiles(first_name, last_name, email, phone)), waitlist(*), staff(id, name, color)")
      .eq("studio_id", studioId).order("starts_at", { ascending: true });
    const { data: bookingData } = await supabase.from("bookings")
      .select("id, class_id, user_id, created_at, payment_method, profiles(first_name, last_name, email, phone), classes(id, name, starts_at, price_pln, venue_cost_pln, duration_min, max_spots)")
      .eq("studio_id", studioId).order("created_at", { ascending: false });
    const { data: profileData } = await supabase.from("profiles").select("*")
      .eq("role", "client").eq("studio_id", studioId).order("created_at", { ascending: false });
    const { data: notifData } = await supabase.from("notifications").select("*")
      .eq("studio_id", studioId).order("created_at", { ascending: false }).limit(50);
    const { data: histData } = await supabase.from("token_history")
      .select("*, classes(name, starts_at, price_pln), profiles(first_name, last_name)")
      .eq("studio_id", studioId).order("created_at", { ascending: false });
    setClasses(classData || []);
    setAllBookings(bookingData || []);
    setAllProfiles(profileData || []);
    setNotifications(notifData || []);
    setTokenHistory(histData || []);
    setUnreadCount((notifData || []).filter(n => !n.read).length);
    setStats({
      totalClasses: (classData || []).filter(c => c.starts_at >= now && !c.cancelled).length,
      totalBookings: (bookingData || []).filter(b => b.classes?.starts_at >= now).length,
      uniqueClients: (profileData || []).length,
    });
    const { data: templatesData } = await supabase.from("class_templates").select("*").eq("studio_id", studioId).order("name");
    setTemplates(templatesData || []);
    const { data: ratingsData } = await supabase.from("class_ratings")
      .select("*, classes(name, starts_at), profiles(first_name, last_name)")
      .eq("studio_id", studioId).order("created_at", { ascending: false });
    setClassRatings(ratingsData || []);
    if (hasServices) {
      const { data: staffData } = await supabase.from("staff").select("*").eq("studio_id", studioId).order("name");
      setStaff(staffData || []);
      const { data: servicesData } = await supabase.from("services").select("*").eq("studio_id", studioId).order("name");
      setServices(servicesData || []);
    }
    setLoading(false);
  }

  async function handleSaveStaff() {
    if (!staffForm.name.trim()) return;
    if (editingStaff) {
      await supabase.from("staff").update({ name: staffForm.name, color: staffForm.color }).eq("id", editingStaff.id);
      setEditingStaff(null);
    } else {
      await supabase.from("staff").insert({ name: staffForm.name, color: staffForm.color, studio_id: studioId });
    }
    setStaffForm({ name: "", color: "#8A9E85" });
    const { data } = await supabase.from("staff").select("*").eq("studio_id", studioId).order("name");
    setStaff(data || []);
    showMsg("Zapisano pracownika. ✓");
  }

  async function handleDeleteStaff(id) {
    await supabase.from("staff").delete().eq("id", id);
    setStaff(prev => prev.filter(s => s.id !== id));
    showMsg("Usunięto pracownika.");
  }

  async function handleToggleStaff(s) {
    await supabase.from("staff").update({ active: !s.active }).eq("id", s.id);
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x));
  }

  async function handleSaveService() {
    if (!serviceForm.name.trim()) return;
    const payload = { name: serviceForm.name, duration_min: +serviceForm.duration_min, price_pln: +serviceForm.price_pln || 0, studio_id: studioId };
    if (editingService) {
      await supabase.from("services").update(payload).eq("id", editingService.id);
      setEditingService(null);
    } else {
      await supabase.from("services").insert(payload);
    }
    setServiceForm({ name: "", duration_min: 60, price_pln: "" });
    const { data } = await supabase.from("services").select("*").eq("studio_id", studioId).order("name");
    setServices(data || []);
    showMsg("Zapisano usługę. ✓");
  }

  async function handleDeleteService(id) {
    await supabase.from("services").delete().eq("id", id);
    setServices(prev => prev.filter(s => s.id !== id));
    showMsg("Usunięto usługę.");
  }

  async function handleToggleService(s) {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x));
  }

  function openCreateAtSlot(hour, staffId) {
    const d = new Date(staffCalDay);
    d.setHours(hour, 0, 0, 0);
    const pad = n => String(n).padStart(2, "0");
    const localStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(hour)}:00`;
    setEditClass(null);
    setForm({ name: "", starts_at: localStr, duration_min: 60, max_spots: 1, location: "", notes: "", price_pln: "", venue_cost_pln: "", staff_id: staffId === "none" ? "" : (staffId || "") });
    setRecurring({ enabled: false, weeks: 4 });
    setShowModal(true);
  }

  async function handleSaveStudioSettings() {
    if (!studioSettings) return;
    setStudioSettingsSaving(true);
    try {
      let logoUrl = studioSettings.logo_url;
      if (studioLogoFile) {
        const ext = studioLogoFile.name.split(".").pop();
        const path = `${studio.slug}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("logos")
          .upload(path, studioLogoFile, { upsert: true, contentType: studioLogoFile.type });
        if (upErr) throw new Error("Błąd uploadu logo: " + upErr.message);
        const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
        logoUrl = publicUrl;
        setStudioLogoFile(null);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: "update_own_studio",
          payload: {
          name: studioSettings.name,
          branding: {
            nav_name: studioSettings.nav_name,
            hero_eyebrow: studioSettings.hero_eyebrow,
            hero_title: studioSettings.hero_title,
            hero_sub: studioSettings.hero_sub,
            cta_title: studioSettings.cta_title,
            cta_sub: studioSettings.cta_sub,
            email_from: studioSettings.email_from,
            app_url: studioSettings.app_url,
            sms_signature: studioSettings.sms_signature,
            logo_url: logoUrl,
            colors: {
              sage: studioSettings.color_sage,
              clay: studioSettings.color_clay,
              cream: studioSettings.color_cream,
            },
          },
          features: {
            ...(studio?.features || {}),
            tokens_enabled: studioSettings.tokens_enabled,
            multi_staff: studioSettings.multi_staff,
            service_mode: studioSettings.service_mode,
            payments_online: studioSettings.payments_online,
            payment_provider: studioSettings.payment_provider,
          },
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Zastosuj kolory i tytuł od razu bez przeładowania strony
      const root = document.documentElement;
      root.style.setProperty("--sage", studioSettings.color_sage);
      root.style.setProperty("--clay", studioSettings.color_clay);
      root.style.setProperty("--cream", studioSettings.color_cream);
      if (studioSettings.name) document.title = studioSettings.name;

      showMsg("Ustawienia studia zapisane. ✓");
    } catch (e) {
      showMsg("Błąd: " + e.message, "error");
    }
    setStudioSettingsSaving(false);
  }

  async function fetchParticipants(classId) {
    const { data } = await supabase.from("bookings")
      .select("id, created_at, user_id, payment_method, profiles(first_name, last_name, email)")
      .eq("class_id", classId);
    setParticipants(data || []);

    // Pobierz obecności
    const { data: attData } = await supabase.from("attendance")
      .select("*").eq("class_id", classId);
    const attMap = {};
    (attData || []).forEach(a => { attMap[a.user_id] = a.status; });
    setAttendance(attMap);
  }

  async function fetchUserTokens(userId) {
    const { data } = await supabase.from("tokens").select("*").eq("user_id", userId)
      .order("year", { ascending: false }).order("month", { ascending: false });
    const { data: hist } = await supabase.from("token_history").select("*, classes(name)")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setUserTokens(data || []);
    setUserTokenHistory(hist || []);
  }

  async function markAttendance(classId, userId, status) {
    const existing = attendance[userId];
    if (existing) {
      if (existing === status) {
        // Usuń oznaczenie
        await supabase.from("attendance").delete().eq("class_id", classId).eq("user_id", userId);
        setAttendance(prev => { const n = { ...prev }; delete n[userId]; return n; });
      } else {
        await supabase.from("attendance").update({ status }).eq("class_id", classId).eq("user_id", userId);
        setAttendance(prev => ({ ...prev, [userId]: status }));
      }
    } else {
      await supabase.from("attendance").insert({ class_id: classId, user_id: userId, status });
      setAttendance(prev => ({ ...prev, [userId]: status }));
    }
  }

  async function handleCancelClass(cls) {
    if (!cancelReason.trim()) { showMsg("Podaj powód odwołania.", "error"); return; }

    // Oznacz jako odwołane
    await supabase.from("classes").update({ cancelled: true, cancel_reason: cancelReason }).eq("id", cls.id);

    // Zwróć wejścia wszystkim zapisanym z metodą "entries"
    const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
    // 1. Zwroty wejść (indywidualne — zależą od stanu konta)
    for (const booking of bookingsForClass) {
      if (booking.payment_method === "entries") {
        const month = new Date(cls.starts_at).getMonth() + 1;
        const year = new Date(cls.starts_at).getFullYear();
        const { data: tok } = await supabase.from("tokens").select("*")
          .eq("user_id", booking.user_id).eq("month", month).eq("year", year).maybeSingle();
        if (tok) {
          await supabase.from("tokens").update({ amount: tok.amount + 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
          await supabase.from("token_history").insert({
            user_id: booking.user_id, class_id: cls.id, operation: "add", amount: 1,
            month, year, note: `Zwrot — zajęcia odwołane: ${cls.name}`, studio_id: studioId,
          });
        }
      }
    }

    // 2. Powiadomienia w aplikacji — jeden batch insert
    await supabase.from("notifications").insert(
      bookingsForClass.map(b => ({
        type: "class_cancelled", class_id: cls.id, user_id: b.user_id, studio_id: studioId,
        message: `Zajęcia "${cls.name}" (${formatEmailDate(cls.starts_at)}) zostały odwołane. Powód: ${cancelReason}${b.payment_method === "entries" ? " Wejście zwrócono." : ""}`,
      }))
    );

    // 3. Emaile + SMS + Push
    const userIds = bookingsForClass.map(b => b.user_id);
    for (const booking of bookingsForClass) {
      await sendEmail("class_cancelled", booking.profiles?.email, {
        firstName: booking.profiles?.first_name,
        className: cls.name,
        date: formatEmailDate(cls.starts_at),
        time: formatEmailTime(cls.starts_at),
        reason: cancelReason,
        refunded: booking.payment_method === "entries",
      });
      await sendSms(booking.profiles?.phone,
        `Zajecia "${cls.name}" (${smsDate(cls.starts_at)}) zostaly odwolane.${booking.payment_method === "entries" ? " Wejscie zwrocono." : ""} - ${smsSig}`
      );
    }
    if (userIds.length > 0 && !isDemo) {
      fetch("/api/push-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds,
          title: "Zajęcia odwołane",
          body: `"${cls.name}" (${formatEmailDate(cls.starts_at)}) zostały odwołane. ${cancelReason}`,
          url: "/",
        }),
      }).catch(() => {});
    }

    setShowCancelModal(null);
    setCancelReason("");
    showMsg(`Zajęcia odwołane. Powiadomiono ${bookingsForClass.length} uczestników.`);
    await fetchAll();
  }

  async function handleSendMessage(cls) {
    if (!messageText.trim()) { showMsg("Wpisz wiadomość.", "error"); return; }
    const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
    const notifMsg = `📢 Wiadomość dot. zajęć "${cls.name}": ${messageText}`;

    // Zapisz wiadomość
    await supabase.from("class_messages").insert({
      class_id: cls.id, message: messageText, sent_by: session.user.id, studio_id: studioId,
    });

    // Powiadomienia w aplikacji — jeden batch insert
    if (msgDelivery.app) {
      await supabase.from("notifications").insert(
        bookingsForClass.map(b => ({ type: "booking", class_id: cls.id, user_id: b.user_id, message: notifMsg, studio_id: studioId }))
      );
    }

    // Email
    if (msgDelivery.email) {
      for (const b of bookingsForClass) {
        if (b.profiles?.email) {
          await sendEmail("message", b.profiles.email, {
            firstName: b.profiles.first_name, className: cls.name, message: messageText,
          });
        }
      }
    }

    // SMS
    if (msgDelivery.sms) {
      const withPhone = bookingsForClass.filter(b => b.profiles?.phone);
      for (const b of withPhone) {
        await sendSms(b.profiles.phone, `${cls.name}: ${messageText} - ${smsSig}`);
      }
      if (withPhone.length < bookingsForClass.length) {
        const noPhone = bookingsForClass.length - withPhone.length;
        showMsg(`SMS wysłano do ${withPhone.length} os. (${noPhone} bez numeru).`);
      }
    }

    // Push
    if (msgDelivery.app) {
      const uids = bookingsForClass.map(b => b.user_id);
      if (uids.length > 0 && !isDemo) {
        fetch("/api/push-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: uids, title: cls.name, body: messageText, url: "/" }),
        }).catch(() => {});
      }
    }

    setShowMessageModal(null);
    setMessageText("");
    setMsgDelivery({ app: true, email: false, sms: false });
    showMsg(`Wiadomość wysłana do ${bookingsForClass.length} uczestników!`);
    await fetchAll();
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false).eq("studio_id", studioId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function openCreate() {
    setEditClass(null);
    setForm({ name: "", starts_at: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "", staff_id: "" });
    setRecurring({ enabled: false, weeks: 4 });
    setShowModal(true);
  }

  function openEdit(cls) {
    setEditClass(cls);
    setEditSeriesAll(false);
    const local = new Date(cls.starts_at);
    const localStr = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({ name: cls.name, starts_at: localStr, duration_min: cls.duration_min, max_spots: cls.max_spots, location: cls.location || "", notes: cls.notes || "", price_pln: cls.price_pln || "", venue_cost_pln: cls.venue_cost_pln || "", staff_id: cls.staff_id || "" });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.starts_at) return;

    // Zapobiega duplikatom — ta sama godzina i ten sam pracownik
    if (!editClass && form.staff_id) {
      const newStart = new Date(form.starts_at).toISOString();
      const duplicate = classes.find(c =>
        !c.cancelled &&
        c.staff_id === form.staff_id &&
        new Date(c.starts_at).toISOString().slice(0, 16) === newStart.slice(0, 16)
      );
      if (duplicate) {
        showMsg(`Ten pracownik ma już wizytę o ${formatTime(duplicate.starts_at)}.`, "error");
        return;
      }
    }

    const basePayload = {
      name: form.name, starts_at: new Date(form.starts_at).toISOString(),
      duration_min: +form.duration_min, max_spots: +form.max_spots,
      location: form.location, notes: form.notes,
      price_pln: form.price_pln ? +form.price_pln : null,
      venue_cost_pln: form.venue_cost_pln ? +form.venue_cost_pln : null,
      staff_id: form.staff_id || null,
    };

    if (editClass) {
      if (editSeriesAll && editClass.series_id) {
        // Aktualizuj wszystkie zajęcia z tej serii (bez starts_at — każda ma swoją datę)
        const { name, duration_min, max_spots, location, notes, price_pln, venue_cost_pln } = basePayload;
        await supabase.from("classes").update({ name, duration_min, max_spots, location, notes, price_pln, venue_cost_pln })
          .eq("series_id", editClass.series_id);
        showMsg("Zaktualizowano wszystkie zajęcia z serii! ✓");
      } else {
        await supabase.from("classes").update(basePayload).eq("id", editClass.id);
      }
    } else if (recurring.enabled && recurring.weeks > 1) {
      // Utwórz serię zajęć
      const seriesId = crypto.randomUUID();
      const classesToInsert = [];
      for (let i = 0; i < recurring.weeks; i++) {
        const starts = new Date(form.starts_at);
        starts.setDate(starts.getDate() + i * 7);
        classesToInsert.push({ ...basePayload, starts_at: starts.toISOString(), series_id: seriesId, series_index: i + 1, studio_id: studioId });
      }
      await supabase.from("classes").insert(classesToInsert);
      showMsg(`Utworzono ${recurring.weeks} zajęć cyklicznych! ✓`);
    } else {
      await supabase.from("classes").insert({ ...basePayload, studio_id: studioId });
    }

    setShowModal(false);
    await fetchAll();
  }

  async function handleSaveTemplate() {
    if (!templateForm.name) return;
    await supabase.from("class_templates").insert({
      name: templateForm.name,
      duration_min: +templateForm.duration_min,
      max_spots: +templateForm.max_spots,
      location: templateForm.location,
      notes: templateForm.notes,
      price_pln: templateForm.price_pln ? +templateForm.price_pln : null,
      venue_cost_pln: templateForm.venue_cost_pln ? +templateForm.venue_cost_pln : null,
      studio_id: studioId,
    });
    setShowTemplateModal(false);
    setTemplateForm({ name: "", duration_min: 60, max_spots: 10, location: "", notes: "", price_pln: "", venue_cost_pln: "" });
    showMsg("Szablon zapisany! ✓");
    const { data } = await supabase.from("class_templates").select("*").order("name");
    setTemplates(data || []);
  }

  async function handleDeleteTemplate(id) {
    await supabase.from("class_templates").delete().eq("id", id);
    const { data } = await supabase.from("class_templates").select("*").order("name");
    setTemplates(data || []);
  }

  function applyTemplate(template) {
    setForm(prev => ({
      ...prev,
      name: template.name,
      duration_min: template.duration_min,
      max_spots: template.max_spots,
      location: template.location || "",
      notes: template.notes || "",
      price_pln: template.price_pln || "",
      venue_cost_pln: template.venue_cost_pln || "",
    }));
    showMsg(`Szablon "${template.name}" wczytany!`);
  }

  // Eksport listy obecności do PDF (print)
  function printAttendanceList(cls, participants) {
    const win = window.open('', '_blank');
    const date = new Date(cls.starts_at).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const time = new Date(cls.starts_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    const rows = participants.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.profiles?.first_name || ""} ${p.profiles?.last_name || ""}</td>
        <td>${p.payment_method === "entries" ? "Karnet" : "Gotówka"}</td>
        <td style="width:120px;border-bottom:1px solid #ccc;"></td>
      </tr>
    `).join("");
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Lista obecności — ${cls.name}</title>
        <style>
          body { font-family: Georgia, serif; padding: 2rem; color: #2C2C2C; }
          h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
          .meta { color: #6B6B6B; font-size: 0.9rem; margin-bottom: 2rem; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 0.5rem 1rem; background: #F7F3EE; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #E8E0D8; }
          td { padding: 0.75rem 1rem; border-bottom: 1px solid #E8E0D8; font-size: 0.9rem; }
          .footer { margin-top: 3rem; font-size: 0.8rem; color: #ADADAD; text-align: center; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>${cls.name}</h1>
        <div class="meta">${date} · ${time} · ${cls.duration_min} min${cls.location ? " · " + cls.location : ""}</div>
        <table>
          <thead><tr><th>#</th><th>Imię i nazwisko</th><th>Płatność</th><th>Podpis</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">${studioName} · Wygenerowano: ${new Date().toLocaleDateString("pl-PL")}</div>
        <br/>
        <button onclick="window.print()">🖨️ Drukuj</button>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  function exportCSV(rd) {
    const rows = [
      ["Zajęcia", "Data", "Uczestnicy", "Maks.", "Obłożenie %", "Przychód PLN", "Koszt sali PLN", "Dochód PLN"],
      ...rd.classReports.map(r => [
        r.cls.name,
        new Date(r.cls.starts_at).toLocaleDateString("pl-PL"),
        r.bookings.length,
        r.cls.max_spots,
        r.occupancy,
        r.revenue,
        r.venueCost,
        r.profit,
      ]),
      [],
      ["RAZEM", "", rd.classReports.reduce((s,r)=>s+r.bookings.length,0), "", rd.avgOccupancy, rd.totalRevenue, rd.totalCosts, rd.totalProfit],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pilates-raport-${reportYear}-${String(reportMonth).padStart(2,"0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id) {
    if (!confirm("Na pewno usunąć te zajęcia?")) return;
    await supabase.from("bookings").delete().eq("class_id", id);
    await supabase.from("waitlist").delete().eq("class_id", id);
    await supabase.from("classes").delete().eq("id", id);
    await fetchAll();
  }

  async function handleAddUserToClass(userId, classId) {
    const { error } = await supabase.from("bookings").insert({ class_id: classId, user_id: userId, payment_method: "cash", studio_id: studioId });
    if (error) { showMsg("Użytkownik już jest zapisany.", "error"); return; }
    showMsg("Zapisano! ✓");
    const cls = classes.find(c => c.id === classId);
    const { data: userProfile } = await supabase.from("profiles").select("email, first_name").eq("id", userId).single();
    if (userProfile && cls) {
      await sendEmail("booking_confirmed", userProfile.email, {
        firstName: userProfile.first_name, className: cls.name,
        date: formatEmailDate(cls.starts_at), time: formatEmailTime(cls.starts_at),
        duration: cls.duration_min, location: cls.location || "", notes: cls.notes || "", paymentMethod: "cash",
      });
    }
    setShowAddUserModal(false);
    await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  function openParticipants(cls) {
    setSelectedClass(cls);
    fetchParticipants(cls.id);
    setTab("participants");
  }

  function openUserTokens(user) {
    setSelectedUser(user);
    setTokenForm({ amount: 1, month: new Date().getMonth() + 1, year: new Date().getFullYear(), note: "" });
    fetchUserTokens(user.id);
    setShowTokenModal(true);
  }

  async function handleAddTokens() {
    const { data: existing } = await supabase.from("tokens").select("*")
      .eq("user_id", selectedUser.id).eq("month", tokenForm.month).eq("year", tokenForm.year).maybeSingle();
    if (existing) {
      await supabase.from("tokens").update({ amount: existing.amount + tokenForm.amount, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tokens").insert({ user_id: selectedUser.id, amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, added_by: session.user.id, note: tokenForm.note, studio_id: studioId });
    }
    await supabase.from("token_history").insert({ user_id: selectedUser.id, operation: "add", amount: tokenForm.amount, month: tokenForm.month, year: tokenForm.year, note: tokenForm.note || "Dodano przez admina", studio_id: studioId });
    const entryWord = tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść";
    await supabase.from("notifications").insert({ type: "tokens_added", user_id: selectedUser.id, studio_id: studioId, message: `Dodano ${tokenForm.amount} ${entryWord} dla ${selectedUser.first_name} ${selectedUser.last_name} na ${monthName(tokenForm.month)} ${tokenForm.year}` });
    const { data: userProfile } = await supabase.from("profiles").select("email, first_name").eq("id", selectedUser.id).single();
    if (userProfile) {
      await sendEmail("entries_added", userProfile.email, {
        firstName: userProfile.first_name, amount: tokenForm.amount,
        month: monthName(tokenForm.month) + " " + tokenForm.year, note: tokenForm.note || "",
      });
    }
    const eWord = tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść";
    showMsg(`Dodano ${tokenForm.amount} ${eWord} dla ${selectedUser.first_name}! ✓`);
    await fetchUserTokens(selectedUser.id);
    await fetchAll();
  }

  async function handleUseToken(userId, classId, className) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const { data: tok } = await supabase.from("tokens").select("*").eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle();
    if (!tok || tok.amount <= 0) { showMsg("Brak wejść.", "error"); return; }
    await supabase.from("tokens").update({ amount: tok.amount - 1, updated_at: new Date().toISOString() }).eq("id", tok.id);
    await supabase.from("token_history").insert({ user_id: userId, class_id: classId, operation: "use", amount: -1, month, year, note: `Zużyto za: ${className}`, studio_id: studioId });
    showMsg("Wejście zużyte! ✓");
    await fetchAll();
  }

  async function handleSettleNow(userId, classId, className, startsAt) {
    const d = new Date(startsAt);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const { data: existing } = await supabase.from("tokens").select("*")
      .eq("user_id", userId).eq("month", month).eq("year", year).maybeSingle();

    if (existing && existing.amount > 0) {
      // Odejmij wejście jeśli jest saldo
      await supabase.from("tokens")
        .update({ amount: existing.amount - 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else if (!existing) {
      // Utwórz rekord z 0 (zaznaczamy że rozliczono bez wejść — gotówka)
      await supabase.from("tokens").insert({ user_id: userId, amount: 0, month, year, added_by: session.user.id, studio_id: studioId });
    }
    // Zawsze zapisz log rozliczenia
    await supabase.from("token_history").insert({
      user_id: userId, class_id: classId, operation: "use", amount: -1,
      month, year, note: `Rozliczono za: ${className}`, studio_id: studioId,
    });
    showMsg("Rozliczono! ✓");
    await fetchAll();
  }

  function monthName(m) {
    if (lang === "en") return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1];
    return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
  }
  function formatDate(iso) { return new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function formatTime(iso) { return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }); }
  function formatRelative(iso) {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return t("przed chwilą", "just now");
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t("min temu", "min ago")}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t("godz. temu", "hr ago")}`;
    return formatDate(iso);
  }

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async function handleAddParticipant() {
    if (!addParticipantId || !editClass) return;
    setAddingParticipant(true);
    await supabase.from("bookings").insert({ class_id: editClass.id, user_id: addParticipantId, payment_method: addParticipantMethod, studio_id: studioId });
    await fetchAll();
    setAddParticipantId("");
    setAddingParticipant(false);
    showMsg("Uczestnik dodany ✓");
  }

  async function handleCreateNewClient() {
    const { first_name, last_name, email, phone, birth_date } = newClientForm;
    if (!first_name || !last_name || !email) { showMsg("Wypełnij imię, nazwisko i email.", "error"); return; }
    setNewClientLoading(true);
    const res = await fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name, last_name, email, phone, birth_date, studioId }),
    });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || "Błąd tworzenia konta.", "error"); setNewClientLoading(false); return; }
    if (newClientContext === "class" && editClass) {
      await supabase.from("bookings").insert({ class_id: editClass.id, user_id: data.id, payment_method: addParticipantMethod, studio_id: studioId });
    }
    await fetchAll();
    showMsg(`Konto dla ${first_name} ${last_name} utworzone! ✓`);
    setNewClientForm({ first_name: "", last_name: "", email: "", phone: "", birth_date: "" });
    setShowNewClientModal(false);
    setNewClientLoading(false);
  }

  async function handleRemoveParticipant(bookingId) {
    await supabase.from("bookings").delete().eq("id", bookingId);
    if (selectedClass) await fetchParticipants(selectedClass.id);
    await fetchAll();
  }

  function openEditClient(client) {
    setEditingClient(client);
    setClientForm({ first_name: client.first_name || "", last_name: client.last_name || "", phone: client.phone || "", birth_date: client.birth_date || "", role: client.role || "client" });
  }

  async function saveEditClient() {
    if (!editingClient) return;
    await supabase.from("profiles").update({ first_name: clientForm.first_name, last_name: clientForm.last_name, phone: clientForm.phone || null, birth_date: clientForm.birth_date || null, role: clientForm.role }).eq("id", editingClient.id);
    setAllProfiles(prev => prev.map(p => p.id === editingClient.id ? { ...p, ...clientForm } : p));
    setEditingClient(null);
    showMsg("Dane klienta zaktualizowane ✓");
  }

  function getAnnualData() {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthClasses = classes.filter(c => {
        const d = new Date(c.starts_at);
        return d.getMonth() + 1 === month && d.getFullYear() === reportYear && !c.cancelled && new Date(c.starts_at) < new Date();
      });
      const monthBookings = allBookings.filter(b => {
        const d = new Date(b.classes?.starts_at);
        return d.getMonth() + 1 === month && d.getFullYear() === reportYear;
      });
      const revenue = monthClasses.reduce((s, c) => s + (c.price_pln || 0) * monthBookings.filter(b => b.class_id === c.id).length, 0);
      const costs = monthClasses.reduce((s, c) => s + (c.venue_cost_pln || 0), 0);
      return { month, name: monthName(month), shortName: ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"][i], revenue, costs, profit: revenue - costs, classes: monthClasses.length, bookings: monthBookings.length };
    });
  }

  async function sendBulkMessage() {
    if (!bulkMsgText.trim()) return;
    setSendingBulk(true);
    let targetUsers = [];
    if (bulkMsgTarget === "all") {
      targetUsers = allProfiles.filter(p => p.role === "client");
    } else {
      const classBookings = allBookings.filter(b => b.class_id === bulkMsgTargetClass);
      const userIds = new Set(classBookings.map(b => b.user_id));
      targetUsers = allProfiles.filter(p => userIds.has(p.id));
    }
    if (bulkMsgChannels.app && targetUsers.length > 0) {
      await supabase.from("notifications").insert(targetUsers.map(u => ({ user_id: u.id, type: "booking", message: bulkMsgText, studio_id: studioId })));
    }
    if (bulkMsgChannels.push && targetUsers.length > 0 && !isDemo) {
      fetch("/api/push-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: targetUsers.map(u => u.id), title: "Pilates Studio", body: bulkMsgText, url: "/" }) }).catch(() => {});
    }
    if (bulkMsgChannels.sms) {
      for (const u of targetUsers.filter(u => u.phone)) await sendSms(u.phone, bulkMsgText);
    }
    setBulkMsgText("");
    setSendingBulk(false);
    showMsg(`Wysłano do ${targetUsers.length} klientów ✓`);
    await fetchAll();
  }

  async function handleRenameVenue() {
    const newName = renameVenueTo.trim();
    if (!renamingVenue || !newName || newName === renamingVenue) return;
    await supabase.from("classes").update({ location: newName }).eq("location", renamingVenue);
    setClasses(prev => prev.map(c => c.location === renamingVenue ? { ...c, location: newName } : c));
    setRenamingVenue(null);
    setRenameVenueTo("");
    showMsg(`Sala zmieniona: „${renamingVenue}" → „${newName}" ✓`);
  }

  async function saveNotes(userId) {
    await supabase.from("profiles").update({ admin_notes: notesText }).eq("id", userId);
    setAllProfiles(prev => prev.map(p => p.id === userId ? { ...p, admin_notes: notesText } : p));
    setEditingNotes(null);
    showMsg("Notatka zapisana! ✓");
  }

  // Zmiana zakładki — czyści selectedClass gdy wychodzimy z widoku uczestników
  function switchTab(t) {
    if (t !== "participants") setSelectedClass(null);
    setTab(t);
  }

  const upcomingClasses = classes.filter(c => new Date(c.starts_at) >= new Date() && !c.cancelled);
  const cancelledClasses = classes.filter(c => c.cancelled);
  const pastClasses = classes.filter(c => new Date(c.starts_at) < new Date() && !c.cancelled);

  const settled = new Set(tokenHistory.filter(h => h.operation === "use" && !h.note?.includes("przepadło")).map(h => `${h.user_id}_${h.class_id}`));
  const toSettle = allBookings.filter(b => new Date(b.classes?.starts_at) < new Date() && !settled.has(`${b.user_id}_${b.class_id}`));
  const totalOwed = toSettle.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);

  const dayStats = [0,1,2,3,4,5,6].map(day => ({ name: ["Nd","Pn","Wt","Śr","Cz","Pt","So"][day], count: allBookings.filter(b => new Date(b.classes?.starts_at).getDay() === day).length }));
  const maxDay = Math.max(...dayStats.map(d => d.count), 1);
  const hourStats = {};
  allBookings.forEach(b => { const h = new Date(b.classes?.starts_at).getHours(); hourStats[h] = (hourStats[h] || 0) + 1; });
  const topHours = Object.entries(hourStats).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const notifIcon = (type) => ({ booking: "✅", cancel: "❌", waitlist_promoted: "⬆️", tokens_added: "🎫", class_cancelled: "🚫", birthday: "🎂" }[type] || "🔔");
  const notEnrolled = selectedClass ? allProfiles.filter(p => !participants.some(part => part.user_id === p.id)) : [];

  // Raport
  function getReportData() {
    const monthClasses = classes.filter(c => { const d = new Date(c.starts_at); return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const monthBookings = allBookings.filter(b => { const d = new Date(b.classes?.starts_at); return d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const pastMonthClasses = monthClasses.filter(c => new Date(c.starts_at) < new Date() && !c.cancelled);
    const classReports = pastMonthClasses.map(cls => {
      const bookings = monthBookings.filter(b => b.class_id === cls.id);
      const revenue = (cls.price_pln || 0) * bookings.length;
      const venueCost = cls.venue_cost_pln || 0;
      const profit = revenue - venueCost;
      const occupancy = cls.max_spots > 0 ? Math.round((bookings.length / cls.max_spots) * 100) : 0;
      return { cls, bookings, entriesBookings: bookings.filter(b => b.payment_method === "entries"), cashBookings: bookings.filter(b => b.payment_method === "cash"), revenue, venueCost, profit, occupancy };
    });
    const lostEntries = tokenHistory.filter(h => { const d = new Date(h.created_at); return h.operation === "use" && h.note?.includes("przepadło") && d.getMonth() + 1 === reportMonth && d.getFullYear() === reportYear; });
    const clientReports = allProfiles.map(p => {
      const bookings = monthBookings.filter(b => b.user_id === p.id);
      const spent = bookings.reduce((sum, b) => sum + (b.classes?.price_pln || 0), 0);
      const lost = lostEntries.filter(h => h.user_id === p.id).length;
      return { profile: p, bookings, entriesCount: bookings.filter(b => b.payment_method === "entries").length, cashCount: bookings.filter(b => b.payment_method === "cash").length, spent, lost };
    }).filter(c => c.bookings.length > 0);
    return {
      classReports, clientReports, lostEntries,
      totalRevenue: classReports.reduce((s, r) => s + r.revenue, 0),
      totalCosts: classReports.reduce((s, r) => s + r.venueCost, 0),
      totalProfit: classReports.reduce((s, r) => s + r.profit, 0),
      totalBookings: monthBookings.length,
      avgOccupancy: classReports.length > 0 ? Math.round(classReports.reduce((s, r) => s + r.occupancy, 0) / classReports.length) : 0,
    };
  }

  const rd = getReportData();

  const statusStyle = (s) => ({
    present: { bg: "#EBF5EA", color: "#5C7A56", label: "✅ Był/a" },
    absent: { bg: "#FDE8E8", color: "#C44B4B", label: "❌ Nie był/a" },
    late: { bg: "#FEF3E8", color: "#B87333", label: "⏰ Spóźniony/a" },
  }[s] || { bg: "var(--cream)", color: "var(--mid)", label: "— Brak" });

  return (
    <div className="app-layout">
      <style>{`@media print { .sidebar,.mobile-nav,.no-print{display:none!important} .main-content{margin-left:0!important;padding:0!important} .print-header{display:block!important} } .print-header{display:none}`}</style>

      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => switchTab("classes")} style={{ cursor: "pointer" }}>
          {studio?.branding?.logo_url
            ? <img src={studio.branding.logo_url} alt={studioName} style={{ maxHeight: 48, maxWidth: "100%", objectFit: "contain" }} />
            : <h1>{studioName}</h1>}
        </div>
        <nav className="sidebar-nav">
          <div className={`nav-item ${tab === "classes" ? "active" : ""}`} onClick={() => switchTab("classes")}><span className="nav-icon">🗓</span> {classLabel}</div>
          <div className={`nav-item ${tab === "admin_calendar" ? "active" : ""}`} onClick={() => switchTab("admin_calendar")}><span className="nav-icon">📅</span> {t("Kalendarz", "Calendar")}</div>
          <div className={`nav-item ${tab === "settle" ? "active" : ""}`} onClick={() => switchTab("settle")}>
            <span className="nav-icon">💰</span> {t("Do rozliczenia", "Pending")}
            {toSettle.length > 0 && <span style={{ marginLeft: "auto", background: "var(--clay)", color: "white", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.7rem" }}>{toSettle.length}</span>}
          </div>
          <div className={`nav-item ${tab === "notifications" ? "active" : ""}`} onClick={() => { switchTab("notifications"); markAllRead(); }}>
            <span className="nav-icon">🔔</span> {t("Powiadomienia", "Notifications")}
            {unreadCount > 0 && <span style={{ marginLeft: "auto", background: "var(--clay)", color: "white", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.7rem" }}>{unreadCount}</span>}
          </div>
          <div className={`nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => switchTab("clients")}><span className="nav-icon">👥</span> {t("Klienci", "Clients")}</div>
          {multiStaff && <div className={`nav-item ${tab === "staff" ? "active" : ""}`} onClick={() => switchTab("staff")}><span className="nav-icon">🧑‍💼</span> {t("Pracownicy", "Staff")}</div>}
          {hasServices && <div className={`nav-item ${tab === "services" ? "active" : ""}`} onClick={() => switchTab("services")}><span className="nav-icon">🛠</span> {t("Cennik usług", "Services")}</div>}
          {selectedClass && <div className={`nav-item ${tab === "participants" ? "active" : ""}`} onClick={() => switchTab("participants")}><span className="nav-icon">✦</span> {t("Uczestnicy", "Participants")}</div>}

          {/* Sekcja Statystyki — rozwijana */}
          <div
            className={["reports","stats","history"].includes(tab) ? "nav-item active" : "nav-item"}
            onClick={() => setStatsOpen(o => !o)}
            style={{ justifyContent: "space-between", marginTop: "0.25rem", userSelect: "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="nav-icon">📊</span> {t("Statystyki", "Statistics")}
            </span>
            <span style={{ fontSize: "0.7rem", transition: "transform 0.15s", display: "inline-block", transform: (statsOpen || ["reports","stats","history"].includes(tab)) ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
          {(statsOpen || ["reports","stats","history"].includes(tab)) && <>
            <div className={`nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => switchTab("reports")} style={{ paddingLeft: "2.75rem" }}><span className="nav-icon">📈</span> {t("Raporty", "Reports")}</div>
            <div className={`nav-item ${tab === "stats" ? "active" : ""}`} onClick={() => switchTab("stats")} style={{ paddingLeft: "2.75rem" }}><span className="nav-icon">📊</span> {t("Dane", "Data")}</div>
            <div className={`nav-item ${tab === "history" ? "active" : ""}`} onClick={() => switchTab("history")} style={{ paddingLeft: "2.75rem" }}><span className="nav-icon">📋</span> {t("Historia", "History")}</div>
          </>}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
            <div><div className="user-name">{profile?.first_name} {profile?.last_name}</div><div className="user-role">{t("Administrator", "Administrator")}</div></div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <button onClick={() => setDarkMode(!darkMode)}
              style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.5rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
              {darkMode ? "☀️" : "🌙"} {darkMode ? t("Jasny", "Light") : t("Ciemny", "Dark")}
            </button>
            {isMultilingual && (
              <button onClick={() => setLang(lang === "pl" ? "en" : "pl")}
                style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.4rem 0.5rem", cursor: "pointer", color: "var(--mid)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                {lang === "pl" ? "🇬🇧 EN" : "🇵🇱 PL"}
              </button>
            )}
            <button onClick={() => switchTab("studio_settings")}
              style={{ flex: 1, background: tab === "studio_settings" ? "var(--cream)" : "none", border: `1px solid ${tab === "studio_settings" ? "var(--sage)" : "var(--border)"}`, borderRadius: 8, padding: "0.4rem 0.5rem", cursor: "pointer", color: tab === "studio_settings" ? "var(--sage-dark)" : "var(--mid)", fontSize: "0.8rem", fontWeight: tab === "studio_settings" ? 600 : 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
              ⚙️ {t("Ustawienia", "Settings")}
            </button>
          </div>
          <button className="btn-logout" onClick={() => supabase.auth.signOut()}>{t("Wyloguj się", "Log out")}</button>
        </div>
      </aside>

      <main className="main-content">
        {message && <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"}`} style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 999, maxWidth: 400 }}>{message.text}</div>}

        {/* ZAJĘCIA */}
        {tab === "classes" && (
          <>
            <div className="page-header"><h2>{serviceMode === "services" ? t("Zarządzanie usługami", "Manage services") : t("Zarządzanie zajęciami", "Manage classes")}</h2></div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value">{stats.totalClasses}</div><div className="stat-label">{serviceMode === "services" ? t("Nadchodzące wizyty", "Upcoming appointments") : t("Nadchodzące zajęcia", "Upcoming classes")}</div></div>
              <div className="stat-card"><div className="stat-value">{stats.totalBookings}</div><div className="stat-label">{t("Aktywne rezerwacje", "Active bookings")}</div></div>
              <div className="stat-card"><div className="stat-value">{stats.uniqueClients}</div><div className="stat-label">{t("Klientów łącznie", "Total clients")}</div></div>
            </div>
            <div className="section-header"><h3>{serviceMode === "services" ? t("Nadchodzące wizyty", "Upcoming appointments") : t("Nadchodzące zajęcia", "Upcoming classes")}</h3><button className="btn btn-primary" onClick={openCreate}>+ {serviceMode === "services" ? t("Nowa wizyta", "New appointment") : t("Nowe zajęcia", "New class")}</button></div>
            {loading ? <div className="empty-state"><p>{t("Ładowanie...", "Loading...")}</p></div>
              : upcomingClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">🌿</div><p>{t("Brak zajęć.", "No classes.")}</p></div>
              : (
                <div className="table-wrapper" style={{ marginBottom: "2rem" }}>
                  <table>
                    <thead><tr><th>{t("Nazwa","Name")}</th>{multiStaff && <th>{t("Pracownik","Staff")}</th>}<th>{t("Data","Date")}</th><th>{t("Godz.","Time")}</th><th>{t("Cena","Price")}</th><th>{t("Sala","Venue")}</th><th>{t("Miejsca","Spots")}</th><th>{t("Uczestnicy","Participants")}</th><th>{t("Akcje","Actions")}</th></tr></thead>
                    <tbody>
                      {upcomingClasses.map(cls => {
                        const count = cls.bookings?.length || 0;
                        return (
                          <tr key={cls.id}>
                            <td><strong>{cls.name}</strong>{cls.series_id && <span style={{ fontSize: "0.7rem", background: "#EBF5EA", color: "var(--sage-dark)", padding: "0.15rem 0.5rem", borderRadius: 20, marginLeft: "0.5rem" }}>🔁 {cls.series_index}</span>}</td>
                            {multiStaff && <td>{cls.staff ? <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: cls.staff.color, display: "inline-block" }} />{cls.staff.name}</span> : <span style={{ color: "var(--light)" }}>—</span>}</td>}
                            <td>{formatDate(cls.starts_at)}</td>
                            <td>{formatTime(cls.starts_at)}</td>
                            <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
                            <td>{cls.venue_cost_pln ? <span style={{ color: "var(--clay)" }}>{cls.venue_cost_pln} zł</span> : "—"}</td>
                            <td>{count} / {cls.max_spots}</td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openParticipants(cls)}>{t("Lista", "List")} ({count})</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowMessageModal(cls)} title={t("Wyślij wiadomość", "Send message")}>💬</button>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cls)}>{t("Edytuj", "Edit")}</button>
                                <button className="btn btn-danger btn-sm" onClick={() => setShowCancelModal(cls)}>{t("Odwołaj", "Cancel")}</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cls.id)}>{t("Usuń", "Delete")}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {cancelledClasses.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: "1rem" }}><h3 style={{ color: "var(--clay)" }}>🚫 {t("Odwołane zajęcia", "Cancelled classes")}</h3></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>{t("Nazwa","Name")}</th><th>{t("Data","Date")}</th><th>{t("Powód","Reason")}</th></tr></thead>
                    <tbody>
                      {cancelledClasses.map(cls => (
                        <tr key={cls.id} style={{ opacity: 0.6 }}>
                          <td><strong>{cls.name}</strong></td>
                          <td>{formatDate(cls.starts_at)}</td>
                          <td style={{ color: "var(--clay)" }}>{cls.cancel_reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* KALENDARZ ADMINA — MIESIĘCZNY */}
        {tab === "admin_calendar" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div className="page-header" style={{ margin: 0 }}>
                <h2>Kalendarz{hasServices ? " — widok dzienny" : " zajęć"}</h2>
                <p>{hasServices ? "Kliknij pusty slot aby dodać wizytę" : "Miesięczny przegląd"}</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openCreate}>+ {hasServices ? "Nowa wizyta" : "Nowe zajęcia"}</button>
            </div>

            {hasServices ? (() => {
              // ── WIDOK DZIENNY (z kolumnami pracowników lub pojedynczy) ──
              const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8–20
              const activeStaff = staff.filter(s => s.active);
              const staffCols = multiStaff
                ? [...activeStaff, { id: "none", name: "Bez przypisania", color: "#ADADAD" }]
                : [{ id: "none", name: "Wizyty", color: "var(--sage)" }];
              const dayStr = staffCalDay.toDateString();
              const dayClasses = classes.filter(c => new Date(c.starts_at).toDateString() === dayStr && !c.cancelled);
              const prevDay = () => { const d = new Date(staffCalDay); d.setDate(d.getDate() - 1); setStaffCalDay(d); };
              const nextDay = () => { const d = new Date(staffCalDay); d.setDate(d.getDate() + 1); setStaffCalDay(d); };
              const isToday = staffCalDay.toDateString() === new Date().toDateString();

              const getSlotClasses = (staffId, hour) => dayClasses.filter(c => {
                const h = new Date(c.starts_at).getHours();
                return h === hour && (staffId === "none" ? !c.staff_id : c.staff_id === staffId);
              });

              const cellBase = { borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", minHeight: 64, padding: "0.25rem", verticalAlign: "top" };

              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem" }}>
                    <button className="btn btn-secondary btn-sm" onClick={prevDay}>← {t("Poprzedni", "Prev")}</button>
                    <span style={{ fontWeight: 600, fontSize: "1rem", textAlign: "center" }}>
                      {staffCalDay.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      {isToday && <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", background: "var(--sage)", color: "white", padding: "0.1rem 0.4rem", borderRadius: 4 }}>{t("Dziś", "Today")}</span>}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={nextDay}>{t("Następny", "Next")} →</button>
                  </div>

                  <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "var(--warm-white)" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: `${60 + staffCols.length * 160}px` }}>
                      <thead>
                        <tr style={{ background: "var(--cream)" }}>
                          <th style={{ width: 60, padding: "0.6rem 0.5rem", fontSize: "0.72rem", color: "var(--mid)", fontWeight: 500, borderRight: "1px solid var(--border)", borderBottom: "2px solid var(--border)" }}>{t("Godz.","Time")}</th>
                          {staffCols.map(s => (
                            <th key={s.id} style={{ padding: "0.6rem 0.75rem", borderRight: "1px solid var(--border)", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                                <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{s.name}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hours.map(hour => (
                          <tr key={hour} style={{ background: hour % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)" }}>
                            <td style={{ ...cellBase, textAlign: "center", fontSize: "0.75rem", color: "var(--mid)", fontWeight: 500, background: "var(--cream)", width: 60 }}>
                              {`${String(hour).padStart(2,"0")}:00`}
                            </td>
                            {staffCols.map(s => {
                              const slotCls = getSlotClasses(s.id, hour);
                              return (
                                <td key={s.id} style={{ ...cellBase, cursor: slotCls.length === 0 ? "pointer" : "default" }}
                                  onClick={() => slotCls.length === 0 && openCreateAtSlot(hour, s.id)}
                                  onMouseEnter={e => { if (slotCls.length === 0) e.currentTarget.style.background = "rgba(138,158,133,0.07)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                  {slotCls.map(cls => {
                                    const sc = s.id === "none" ? null : activeStaff.find(x => x.id === s.id);
                                    const color = sc?.color || "#ADADAD";
                                    const booked = cls.bookings?.length || 0;
                                    const isFull = booked >= cls.max_spots;
                                    return (
                                      <div key={cls.id} onClick={e => { e.stopPropagation(); openEdit(cls); }}
                                        style={{ background: `${color}18`, border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`, borderRadius: 5, padding: "0.3rem 0.5rem", cursor: "pointer", marginBottom: "0.2rem" }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                                        <div style={{ fontWeight: 600, fontSize: "0.78rem" }}>{cls.name}</div>
                                        <div style={{ fontSize: "0.7rem", color: "var(--mid)" }}>{formatTime(cls.starts_at)} · {cls.duration_min} min</div>
                                        <div style={{ fontSize: "0.7rem", color: isFull ? "var(--clay)" : "var(--sage-dark)", fontWeight: 500 }}>{booked}/{cls.max_spots} {isFull ? `● ${t("pełne", "full")}` : ""}</div>
                                      </div>
                                    );
                                  })}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--mid)", marginTop: "0.5rem" }}>{t("Kliknij pusty slot aby szybko dodać wizytę w wybranej godzinie i u wybranego pracownika.", "Click an empty slot to quickly add an appointment at the selected time and staff member.")}</p>
                </>
              );
            })() : (() => {
              // ── WIDOK MIESIĘCZNY (standardowy) ──
              const year = adminCalendarWeek.getFullYear();
              const month = adminCalendarWeek.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const aDayNames = lang === "en" ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] : ["Pon","Wt","Śr","Czw","Pt","Sob","Nd"];
              const isTodayA = d => d.toDateString() === new Date().toDateString();
              let startOffset = firstDay.getDay() - 1;
              if (startOffset < 0) startOffset = 6;
              const cells = [];
              for (let i = 0; i < startOffset; i++) cells.push(null);
              for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
              while (cells.length % 7 !== 0) cells.push(null);
              const mBookings = allBookings.filter(b => { const d = new Date(b.classes?.starts_at); return d.getMonth() === month && d.getFullYear() === year; });
              const mRevenue = mBookings.reduce((s, b) => s + (b.classes?.price_pln || 0), 0);
              const mClasses = classes.filter(c => { const d = new Date(c.starts_at); return d.getMonth() === month && d.getFullYear() === year && !c.cancelled; });
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(adminCalendarWeek); d.setMonth(d.getMonth() - 1); d.setDate(1); setAdminCalendarWeek(d); }}>← {t("Poprzedni","Prev")}</button>
                    <span style={{ fontWeight: 500, fontSize: "1.1rem" }}>{adminCalendarWeek.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => { const d = new Date(adminCalendarWeek); d.setMonth(d.getMonth() + 1); d.setDate(1); setAdminCalendarWeek(d); }}>{t("Następny","Next")} →</button>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    {[[t("Zajęć","Classes"), mClasses.length],[t("Rezerwacji","Bookings"), mBookings.length],[t("Przychód","Revenue"), `${mRevenue} zł`]].map(([label, val], i) => (
                      <div key={i} style={{ background: "var(--warm-white)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--sage-dark)" }}>{val}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--warm-white)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                      {aDayNames.map(d => <div key={d} style={{ padding: "0.6rem 0.25rem", textAlign: "center", background: "var(--cream)", fontSize: "0.75rem", fontWeight: 500, color: "var(--mid)", textTransform: "uppercase" }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                      {cells.map((day, i) => {
                        if (!day) return <div key={i} style={{ minHeight: 90, background: "var(--cream)", opacity: 0.3, borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)" }} />;
                        const today = isTodayA(day);
                        const dayClasses = classes.filter(cls => { const d = new Date(cls.starts_at); return d.toDateString() === day.toDateString() && !cls.cancelled; });
                        return (
                          <div key={i} style={{ minHeight: 90, padding: "0.3rem", borderRight: (i+1)%7!==0?"1px solid var(--border)":"none", borderBottom: "1px solid var(--border)", background: today?"rgba(138,158,133,0.06)":"transparent" }}>
                            <div style={{ fontSize: "0.8rem", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: today?"var(--sage)":"transparent", color: today?"white":"var(--charcoal)", marginBottom: "0.2rem", fontWeight: today?600:400 }}>{day.getDate()}</div>
                            {dayClasses.map(cls => {
                              const count = cls.bookings?.length || 0;
                              const pct = Math.round((count / cls.max_spots) * 100);
                              const isFull = count >= cls.max_spots;
                              const bg = isFull?"#FEF3E8":pct>=70?"#EBF5EA":"var(--cream)";
                              const bdr = isFull?"#E8C5B5":pct>=70?"#8A9E85":"var(--border)";
                              const tc = isFull?"var(--clay)":pct>=70?"var(--sage-dark)":"var(--charcoal)";
                              return (
                                <div key={cls.id} onClick={() => openEdit(cls)} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 4, padding: "0.2rem 0.35rem", marginBottom: "0.2rem", cursor: "pointer" }}
                                  onMouseEnter={e => e.currentTarget.style.opacity="0.75"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                                  <div style={{ fontSize: "0.68rem", fontWeight: 500, color: tc, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatTime(cls.starts_at)} · {cls.name}</div>
                                  <div style={{ fontSize: "0.62rem", color: "var(--light)" }}>{count}/{cls.max_spots}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                    {[["var(--cream)","var(--border)","< 70%"],["#EBF5EA","#8A9E85","≥ 70%"],["#FEF3E8","#E8C5B5",t("Pełne","Full")]].map(([bg,bdr,label]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--mid)" }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${bdr}` }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* UCZESTNICY + LISTA OBECNOŚCI */}
        {/* UCZESTNICY + LISTA OBECNOŚCI */}
        {tab === "participants" && selectedClass && (
          <>
            <div className="page-header">
              <h2>{selectedClass.name}</h2>
              <p>{formatDate(selectedClass.starts_at)} o {formatTime(selectedClass.starts_at)}</p>
            </div>
            <div className="section-header">
              <h3>{t("Lista uczestników", "Participants")} ({participants.length} / {selectedClass.max_spots})</h3>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowMessageModal(selectedClass)}>💬 {t("Wiadomość", "Message")}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => printAttendanceList(selectedClass, participants)}>🖨️ {t("Lista PDF", "PDF list")}</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddUserModal(true)}>+ {t("Dodaj", "Add")}</button>
                <button className="btn btn-secondary" onClick={() => switchTab("classes")}>← {t("Wróć", "Back")}</button>
              </div>
            </div>

            {/* Legenda obecności */}
            {new Date(selectedClass.starts_at) < new Date() && (
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{t("Oznacz obecność:", "Mark attendance:")}</span>
                {["present","absent","late"].map(s => {
                  const st = statusStyle(s);
                  return <span key={s} style={{ fontSize: "0.8rem", background: st.bg, color: st.color, padding: "0.2rem 0.6rem", borderRadius: 20 }}>{st.label}</span>;
                })}
              </div>
            )}

            {participants.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>{t("Nikt się nie zapisał", "No participants yet")}</p></div>
              : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>#</th><th>{t("Imię i nazwisko","Name")}</th><th>Email</th><th>{t("Płatność","Payment")}</th>
                      {new Date(selectedClass.starts_at) < new Date() && <th>{t("Obecność","Attendance")}</th>}
                      <th>{t("Akcja","Action")}</th></tr></thead>
                    <tbody>
                      {participants.map((b, i) => {
                        const attStatus = attendance[b.user_id];
                        const isPast = new Date(selectedClass.starts_at) < new Date();
                        const st = statusStyle(attStatus);
                        return (
                          <tr key={b.id}>
                            <td>{i + 1}</td>
                            <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                            <td style={{ fontSize: "0.85rem" }}>{b.profiles?.email}</td>
                            <td>{b.payment_method === "entries" ? "🎫" : "💵"}</td>
                            {isPast && (
                              <td>
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                  {["present","absent","late"].map(s => {
                                    const ss = statusStyle(s);
                                    const isActive = attStatus === s;
                                    return (
                                      <button key={s} onClick={() => markAttendance(selectedClass.id, b.user_id, s)}
                                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", border: `1px solid ${isActive ? ss.color : "var(--border)"}`, borderRadius: 6, background: isActive ? ss.bg : "transparent", color: isActive ? ss.color : "var(--mid)", cursor: "pointer", transition: "all 0.15s" }}>
                                        {ss.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            )}
                            <td>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                {isPast && b.payment_method !== "entries" && !settled.has(`${b.user_id}_${selectedClass.id}`) && (
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleUseToken(b.user_id, selectedClass.id, selectedClass.name)}>🎫</button>
                                )}
                                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveParticipant(b.id)}>{t("Usuń","Remove")}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            {/* Podsumowanie obecności */}
            {new Date(selectedClass.starts_at) < new Date() && Object.keys(attendance).length > 0 && (
              <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {["present","absent","late"].map(s => {
                  const count = Object.values(attendance).filter(a => a === s).length;
                  const st = statusStyle(s);
                  return count > 0 ? (
                    <div key={s} style={{ background: st.bg, color: st.color, borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500 }}>
                      {st.label}: {count}
                    </div>
                  ) : null;
                })}
                <div style={{ background: "var(--cream)", color: "var(--mid)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  {t("Nieoznaczonych:", "Unmarked:")} {participants.length - Object.keys(attendance).length}
                </div>
              </div>
            )}
          </>
        )}

        {/* DO ROZLICZENIA */}
        {tab === "settle" && (
          <>
            <div className="page-header"><h2>{t("Do rozliczenia", "Pending settlement")}</h2></div>
            {toSettle.length === 0 ? <div className="empty-state"><div className="empty-icon">✅</div><p>{t("Wszystko rozliczone!", "All settled!")}</p></div>
              : (
                <>
                  <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                    <div className="stat-card"><div className="stat-value">{toSettle.length}</div><div className="stat-label">{t("Nierozliczonych", "Unsettled")}</div></div>
                    {totalOwed > 0 && <div className="stat-card"><div className="stat-value" style={{ color: "var(--clay)" }}>{totalOwed} zł</div><div className="stat-label">{t("Łącznie", "Total")}</div></div>}
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>{t("Klientka","Client")}</th><th>{t("Zajęcia","Class")}</th><th>{t("Data","Date")}</th><th>{t("Metoda","Method")}</th><th>{t("Cena","Price")}</th><th>{t("Akcja","Action")}</th></tr></thead>
                      <tbody>
                        {toSettle.map(b => (
                          <tr key={b.id}>
                            <td><strong>{b.profiles?.first_name} {b.profiles?.last_name}</strong></td>
                            <td>{b.classes?.name}</td>
                            <td>{b.classes?.starts_at ? formatDate(b.classes.starts_at) : "—"}</td>
                            <td>{b.payment_method === "entries" ? "🎫" : "💵"}</td>
                            <td>{b.classes?.price_pln ? <strong style={{ color: "var(--clay)" }}>{b.classes.price_pln} zł</strong> : "—"}</td>
                            <td><button className="btn btn-primary btn-sm" onClick={() => handleSettleNow(b.user_id, b.class_id, b.classes?.name, b.classes?.starts_at)}>✓ {t("Rozlicz","Settle")}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </>
        )}

        {/* RAPORTY */}
        {tab === "reports" && (
          <>
            <div className="print-header" style={{ marginBottom: "1rem" }}>
              <h2>Pilates Studio — {t("Raport", "Report")} {monthName(reportMonth)} {reportYear}</h2>
              <p style={{ color: "#666", fontSize: "0.85rem" }}>{t("Wygenerowano:", "Generated:")} {new Date().toLocaleDateString(locale)}</p>
            </div>
            <div className="page-header no-print"><h2>{t("Raporty i rozliczenia", "Reports & finances")}</h2></div>
            <div className="no-print" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select className="form-input" style={{ width: "auto" }} value={reportMonth} onChange={e => setReportMonth(+e.target.value)}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                </select>
                <select className="form-input" style={{ width: "auto" }} value={reportYear} onChange={e => setReportYear(+e.target.value)}>
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["annual","summary","venues","classes","clients","entries","ratings"].map(v => (
                  <button key={v} className={`btn ${reportView === v ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setReportView(v)}>
                    {v === "annual" ? `📅 ${t("Rok","Year")}` : v === "summary" ? t("Podsumowanie","Summary") : v === "venues" ? `🏢 ${t("Sale","Venues")}` : v === "classes" ? t("Zajęcia","Classes") : v === "clients" ? t("Klienci","Clients") : v === "entries" ? t("Wejścia","Credits") : `⭐ ${t("Oceny","Ratings")}`}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(rd)}>⬇️ CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ {t("Drukuj","Print")}</button>
              </div>
            </div>

            {reportView === "annual" && (() => {
              const ad = getAnnualData();
              const maxRev = Math.max(...ad.map(m => m.revenue), 1);
              const totalRev = ad.reduce((s, m) => s + m.revenue, 0);
              const totalProfit = ad.reduce((s, m) => s + m.profit, 0);
              const totalBookings = ad.reduce((s, m) => s + m.bookings, 0);
              const activeMonths = ad.filter(m => m.revenue > 0);
              const bestMonth = activeMonths.length ? activeMonths.reduce((a, b) => a.revenue > b.revenue ? a : b) : null;
              const worstMonth = activeMonths.length > 1 ? activeMonths.reduce((a, b) => a.revenue < b.revenue ? a : b) : null;
              const now = new Date();
              return (
                <>
                  <div className="venue-kpi-row" style={{ marginBottom: "1.5rem" }}>
                    {[
                      { label: t("Przychód roczny","Annual revenue"), value: `${totalRev} zł`, color: "var(--sage-dark)" },
                      { label: t("Zysk netto","Net profit"), value: `${totalProfit} zł`, color: totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" },
                      { label: t("Rezerwacji","Bookings"), value: totalBookings, color: "var(--charcoal)" },
                      { label: t("Najlepszy miesiąc","Best month"), value: bestMonth ? bestMonth.name : "—", color: "var(--sage-dark)", sub: bestMonth ? `${bestMonth.revenue} zł` : "" },
                      { label: t("Najsłabszy miesiąc","Worst month"), value: worstMonth ? worstMonth.name : "—", color: "var(--clay)", sub: worstMonth ? `${worstMonth.revenue} zł` : "" },
                    ].map(({ label, value, color, sub }) => (
                      <div key={label} className="venue-kpi-card">
                        <div className="venue-kpi-value" style={{ color }}>{value}</div>
                        <div className="venue-kpi-label">{label}</div>
                        {sub && <div className="venue-kpi-sub">{sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Wykres słupkowy — 12 miesięcy */}
                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: "1.25rem", color: "var(--charcoal)" }}>Przychody miesięczne — {reportYear}</h3>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 180, paddingBottom: "0.25rem" }}>
                      {ad.map(m => {
                        const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0;
                        const isBest = bestMonth && m.month === bestMonth.month;
                        const isWorst = worstMonth && m.month === worstMonth.month;
                        const isFuture = new Date(reportYear, m.month - 1, 1) > now;
                        const barColor = isFuture ? "var(--border)" : isBest ? "var(--sage)" : isWorst ? "var(--clay)" : "var(--sage-light)";
                        return (
                          <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", height: "100%" }}>
                            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                              <div style={{ width: "100%", height: `${Math.max(pct, isFuture ? 4 : 0)}%`, background: barColor, borderRadius: "4px 4px 0 0", transition: "height 0.4s ease", position: "relative", minHeight: m.revenue > 0 ? 4 : 0 }}>
                                {m.revenue > 0 && <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: "0.6rem", color: "var(--mid)", whiteSpace: "nowrap" }}>{m.revenue} zł</div>}
                              </div>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: isBest ? "var(--sage-dark)" : isWorst ? "var(--clay)" : "var(--mid)", fontWeight: isBest || isWorst ? 600 : 400, textAlign: "center" }}>{m.shortName}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--mid)" }}>
                      {[["var(--sage)","Najlepszy"], ["var(--sage-light)","Pozostałe"], ["var(--clay)","Najsłabszy"], ["var(--border)","Przyszłe"]].map(([c, l]) => (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabela miesięczna */}
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Miesiąc</th><th>Zajęć</th><th>Rezerwacji</th><th>Przychód</th><th>Koszty</th><th>Zysk</th></tr></thead>
                      <tbody>
                        {ad.map(m => {
                          const isBest = bestMonth && m.month === bestMonth.month;
                          const isWorst = worstMonth && m.month === worstMonth.month;
                          return (
                            <tr key={m.month} style={{ background: isBest ? "rgba(138,158,133,0.08)" : isWorst && m.revenue > 0 ? "rgba(196,145,122,0.06)" : "transparent" }}>
                              <td><strong>{m.name}</strong>{isBest && <span style={{ marginLeft: "0.4rem", fontSize: "0.65rem", background: "#EBF5EA", color: "var(--sage-dark)", padding: "0.1rem 0.4rem", borderRadius: 10 }}>★ Najlepszy</span>}{isWorst && m.revenue > 0 && <span style={{ marginLeft: "0.4rem", fontSize: "0.65rem", background: "#FEF3E8", color: "var(--clay)", padding: "0.1rem 0.4rem", borderRadius: 10 }}>↓ Najsłabszy</span>}</td>
                              <td style={{ color: "var(--mid)" }}>{m.classes || "—"}</td>
                              <td style={{ color: "var(--mid)" }}>{m.bookings || "—"}</td>
                              <td style={{ color: "var(--sage-dark)", fontWeight: 500 }}>{m.revenue > 0 ? `${m.revenue} zł` : "—"}</td>
                              <td style={{ color: "var(--clay)" }}>{m.costs > 0 ? `${m.costs} zł` : "—"}</td>
                              <td style={{ fontWeight: 600, color: m.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{m.revenue > 0 ? `${m.profit} zł` : "—"}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "var(--cream)", fontWeight: 600 }}>
                          <td>Rok {reportYear}</td>
                          <td>{ad.reduce((s, m) => s + m.classes, 0)}</td>
                          <td>{totalBookings}</td>
                          <td style={{ color: "var(--sage-dark)" }}>{totalRev} zł</td>
                          <td style={{ color: "var(--clay)" }}>{ad.reduce((s, m) => s + m.costs, 0)} zł</td>
                          <td style={{ color: totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{totalProfit} zł</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            {reportView === "summary" && (
              <>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card"><div className="stat-value" style={{ color: "var(--sage-dark)" }}>{rd.totalRevenue} zł</div><div className="stat-label">Przychód</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: "var(--clay)" }}>{rd.totalCosts} zł</div><div className="stat-label">Koszty sal</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{rd.totalProfit} zł</div><div className="stat-label">Dochód netto</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.totalBookings}</div><div className="stat-label">Rezerwacji</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.avgOccupancy}%</div><div className="stat-label">Obłożenie</div></div>
                </div>
                {rd.classReports.length === 0 ? <div className="empty-state"><div className="empty-icon">📈</div><p>Brak danych za {monthName(reportMonth)} {reportYear}</p></div>
                  : (
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>Zajęcia</th><th>Data</th><th>Uczestników</th><th>Obłożenie</th><th>Przychód</th><th>Koszt sali</th><th>Dochód</th></tr></thead>
                        <tbody>
                          {rd.classReports.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.cls.name}</strong></td>
                              <td>{formatDate(r.cls.starts_at)}</td>
                              <td>{r.bookings.length} / {r.cls.max_spots}</td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{ width: `${r.occupancy}%`, height: "100%", background: "var(--sage)", borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: "0.8rem" }}>{r.occupancy}%</span>
                                </div>
                              </td>
                              <td style={{ color: "var(--sage-dark)", fontWeight: 500 }}>{r.revenue} zł</td>
                              <td style={{ color: r.venueCost > 0 ? "var(--clay)" : "var(--light)" }}>{r.venueCost > 0 ? `${r.venueCost} zł` : "—"}</td>
                              <td style={{ fontWeight: 600, color: r.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{r.profit} zł</td>
                            </tr>
                          ))}
                          <tr style={{ background: "var(--cream)", fontWeight: 600 }}>
                            <td colSpan={4}>Łącznie</td>
                            <td style={{ color: "var(--sage-dark)" }}>{rd.totalRevenue} zł</td>
                            <td style={{ color: "var(--clay)" }}>{rd.totalCosts} zł</td>
                            <td style={{ color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{rd.totalProfit} zł</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
              </>
            )}

            {reportView === "venues" && (() => {
              // Grupuj po sali (location)
              const venueMap = {};
              rd.classReports.forEach(r => {
                const key = r.cls.location || "Brak sali";
                if (!venueMap[key]) venueMap[key] = { name: key, classes: [], revenue: 0, costs: 0, profit: 0, bookings: 0, maxPossible: 0 };
                const v = venueMap[key];
                v.classes.push(r);
                v.revenue += r.revenue;
                v.costs += r.venueCost;
                v.profit += r.profit;
                v.bookings += r.bookings.length;
                v.maxPossible += r.cls.max_spots;
              });
              const venues = Object.values(venueMap).sort((a, b) => b.revenue - a.revenue);
              const maxRevenue = Math.max(...venues.map(v => v.revenue), 1);
              const venueColors = ["var(--sage)","var(--clay)","#7B9CC0","#9B8DB5","#C0956B","#6BA5A0"];
              if (rd.classReports.length === 0) return <div className="empty-state"><div className="empty-icon">🏢</div><p>Brak danych za {monthName(reportMonth)} {reportYear}</p></div>;
              return (
                <>
                  {/* KPI top row */}
                  <div className="venue-kpi-row">
                    {[
                      { label: "Przychód", value: `${rd.totalRevenue} zł`, color: "var(--sage-dark)", sub: "łącznie ze wszystkich sal" },
                      { label: "Koszty sal", value: `${rd.totalCosts} zł`, color: "var(--clay)", sub: "wynajem" },
                      { label: "Zysk netto", value: `${rd.totalProfit} zł`, color: rd.totalProfit >= 0 ? "var(--sage-dark)" : "#C44B4B", sub: "przychód − koszty" },
                      { label: "Sale", value: venues.length, color: "var(--charcoal)", sub: "aktywne w tym miesiącu" },
                      { label: "Obłożenie", value: `${rd.avgOccupancy}%`, color: "var(--charcoal)", sub: "średnie zapełnienie" },
                    ].map(({ label, value, color, sub }) => (
                      <div key={label} className="venue-kpi-card">
                        <div className="venue-kpi-value" style={{ color }}>{value}</div>
                        <div className="venue-kpi-label">{label}</div>
                        <div className="venue-kpi-sub">{sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Wykres porównawczy — przychody */}
                  <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.1rem", marginBottom: "1.25rem", color: "var(--charcoal)" }}>Porównanie przychodów</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {venues.map((v, i) => {
                        const pct = Math.round((v.revenue / maxRevenue) * 100);
                        const occPct = v.maxPossible > 0 ? Math.round((v.bookings / v.maxPossible) * 100) : 0;
                        return (
                          <div key={v.name} className="venue-bar-row">
                            <div className="venue-bar-label">{v.name}</div>
                            <div className="venue-bar-track">
                              <div className="venue-bar-fill" style={{ width: `${pct}%`, background: venueColors[i % venueColors.length] }} />
                            </div>
                            <div className="venue-bar-stats">
                              <span style={{ fontWeight: 600, color: venueColors[i % venueColors.length] }}>{v.revenue} zł</span>
                              <span style={{ color: "var(--mid)", fontSize: "0.78rem" }}>obl. {occPct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Karty sal */}
                  <div className="venue-cards-grid">
                    {venues.map((v, i) => {
                      const occPct = v.maxPossible > 0 ? Math.round((v.bookings / v.maxPossible) * 100) : 0;
                      const color = venueColors[i % venueColors.length];
                      const cashCount = v.classes.reduce((s, r) => s + r.cashBookings.length, 0);
                      const entryCount = v.classes.reduce((s, r) => s + r.entriesBookings.length, 0);
                      return (
                        <div key={v.name} className="venue-card">
                          <div className="venue-card-header" style={{ borderColor: color }}>
                            <div className="venue-card-dot" style={{ background: color }} />
                            {renamingVenue === v.name ? (
                              <div style={{ display: "flex", gap: "0.4rem", flex: 1, alignItems: "center" }}>
                                <input className="form-input" style={{ flex: 1, padding: "0.25rem 0.5rem", fontSize: "0.9rem" }}
                                  value={renameVenueTo} onChange={e => setRenameVenueTo(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") handleRenameVenue(); if (e.key === "Escape") setRenamingVenue(null); }}
                                  autoFocus />
                                <button className="btn btn-primary btn-sm" onClick={handleRenameVenue}>Zapisz</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setRenamingVenue(null)}>✕</button>
                              </div>
                            ) : (
                              <>
                                <span className="venue-card-name">{v.name}</span>
                                <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto", marginRight: "0.5rem", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
                                  onClick={() => { setRenamingVenue(v.name); setRenameVenueTo(v.name); }}>✏️ Zmień</button>
                              </>
                            )}
                            <span className="venue-card-classes">{v.classes.length} {v.classes.length === 1 ? "zajęcia" : v.classes.length < 5 ? "zajęcia" : "zajęć"}</span>
                          </div>
                          <div className="venue-card-body">
                            <div className="venue-financials">
                              <div className="venue-fin-item">
                                <span className="venue-fin-val" style={{ color: "var(--sage-dark)" }}>{v.revenue} zł</span>
                                <span className="venue-fin-label">Przychód</span>
                              </div>
                              <div className="venue-fin-sep" />
                              <div className="venue-fin-item">
                                <span className="venue-fin-val" style={{ color: "var(--clay)" }}>{v.costs} zł</span>
                                <span className="venue-fin-label">Koszt sali</span>
                              </div>
                              <div className="venue-fin-sep" />
                              <div className="venue-fin-item">
                                <span className="venue-fin-val" style={{ color: v.profit >= 0 ? "var(--sage-dark)" : "#C44B4B", fontSize: "1.25rem" }}>{v.profit} zł</span>
                                <span className="venue-fin-label">Zysk netto</span>
                              </div>
                            </div>
                            <div className="venue-occ-section">
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                <span style={{ fontSize: "0.78rem", color: "var(--mid)" }}>Obłożenie</span>
                                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: occPct >= 80 ? "var(--sage-dark)" : occPct >= 50 ? "var(--charcoal)" : "var(--clay)" }}>{occPct}%</span>
                              </div>
                              <div className="venue-occ-bar">
                                <div className="venue-occ-fill" style={{ width: `${occPct}%`, background: color }} />
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--mid)", marginTop: "0.3rem" }}>{v.bookings} / {v.maxPossible} miejsc</div>
                            </div>
                            <div className="venue-payment-row">
                              <div className="venue-payment-pill" style={{ background: "#EBF5EA", color: "var(--sage-dark)" }}>🎫 {entryCount} wejść</div>
                              <div className="venue-payment-pill" style={{ background: "var(--cream)", color: "var(--mid)" }}>💵 {cashCount} gotówka</div>
                            </div>
                          </div>
                          {/* Mini lista zajęć */}
                          <div className="venue-class-list">
                            {v.classes.map((r, j) => (
                              <div key={j} className="venue-class-row">
                                <span className="venue-class-date">{formatDate(r.cls.starts_at)}</span>
                                <span className="venue-class-name">{r.cls.name}</span>
                                <span className="venue-class-occ" style={{ color: r.occupancy >= 80 ? "var(--sage-dark)" : "var(--mid)" }}>{r.occupancy}%</span>
                                <span className="venue-class-rev" style={{ color: "var(--sage-dark)" }}>{r.revenue} zł</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {reportView === "classes" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Szczegóły zajęć — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.classReports.length === 0 ? <div className="empty-state"><div className="empty-icon">🗓</div><p>Brak zajęć</p></div>
                  : rd.classReports.map((r, i) => (
                    <div key={i} className="card" style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div><h3 style={{ fontSize: "1.2rem" }}>{r.cls.name}</h3><p style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{formatDate(r.cls.starts_at)} o {formatTime(r.cls.starts_at)}</p></div>
                        <div style={{ textAlign: "right" }}><div style={{ fontSize: "1.4rem", fontWeight: 600, color: r.profit >= 0 ? "var(--sage-dark)" : "#C44B4B" }}>{r.profit} zł</div><div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>dochód netto</div></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.5rem" }}>
                        {[["Uczestnicy", `${r.bookings.length}/${r.cls.max_spots}`],["Obłożenie",`${r.occupancy}%`],["Gotówka",r.cashBookings.length],["Wejścia",r.entriesBookings.length],["Przychód",`${r.revenue} zł`],["Koszt sali",r.venueCost > 0 ? `${r.venueCost} zł` : "—"]].map(([l,v],j) => (
                          <div key={j} style={{ background: "var(--cream)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                            <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase" }}>{l}</div>
                            <div style={{ fontWeight: 500 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}

            {reportView === "clients" && (
              <>
                <div className="section-header" style={{ marginBottom: "1rem" }}><h3>Klienci — {monthName(reportMonth)} {reportYear}</h3></div>
                {rd.clientReports.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>Brak danych</p></div>
                  : <div className="table-wrapper"><table>
                    <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Gotówka</th><th>Wejścia</th><th>Wydano</th><th>Przepadłe</th></tr></thead>
                    <tbody>{rd.clientReports.sort((a,b) => b.spent-a.spent).map((c,i) => (
                      <tr key={i}>
                        <td><strong>{c.profile.first_name} {c.profile.last_name}</strong></td>
                        <td>{c.bookings.length}</td>
                        <td>{c.cashCount > 0 ? `💵 ${c.cashCount}` : "—"}</td>
                        <td>{c.entriesCount > 0 ? `🎫 ${c.entriesCount}` : "—"}</td>
                        <td style={{ fontWeight: 500, color: "var(--sage-dark)" }}>{c.spent > 0 ? `${c.spent} zł` : "—"}</td>
                        <td style={{ color: c.lost > 0 ? "var(--clay)" : "var(--light)" }}>{c.lost > 0 ? `⚠️ ${c.lost}` : "—"}</td>
                      </tr>
                    ))}</tbody></table></div>}
              </>
            )}

            {reportView === "entries" && (
              <>
                <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                  <div className="stat-card"><div className="stat-value">{rd.clientReports.reduce((s,c) => s+c.entriesCount,0)}</div><div className="stat-label">Użytych wejść</div></div>
                  <div className="stat-card"><div className="stat-value" style={{ color: rd.lostEntries.length > 0 ? "var(--clay)" : "var(--light)" }}>{rd.lostEntries.length}</div><div className="stat-label">Przepadłych</div></div>
                  <div className="stat-card"><div className="stat-value">{rd.clientReports.reduce((s,c) => s+c.cashCount,0)}</div><div className="stat-label">Gotówkowych</div></div>
                </div>
                {rd.lostEntries.length > 0 && (
                  <div className="table-wrapper" style={{ marginBottom: "1.5rem" }}>
                    <table>
                      <thead><tr><th>Klientka</th><th>Zajęcia</th><th>Data</th><th>Notatka</th></tr></thead>
                      <tbody>{rd.lostEntries.map((h,i) => (
                        <tr key={i}>
                          <td><strong>{h.profiles?.first_name} {h.profiles?.last_name}</strong></td>
                          <td>{h.classes?.name || "—"}</td>
                          <td>{h.classes?.starts_at ? formatDate(h.classes.starts_at) : "—"}</td>
                          <td style={{ color: "var(--clay)", fontSize: "0.85rem" }}>{h.note}</td>
                        </tr>
                      ))}</tbody></table></div>
                )}
              </>
            )}

            {reportView === "ratings" && (() => {
              // Group ratings by class name for summary
              const byClass = {};
              classRatings.forEach(r => {
                const key = r.classes?.name || "Nieznane";
                if (!byClass[key]) byClass[key] = { name: key, ratings: [] };
                byClass[key].ratings.push(r);
              });
              const classSummary = Object.values(byClass).map(c => ({
                name: c.name,
                count: c.ratings.length,
                avg: (c.ratings.reduce((s,r) => s+r.rating, 0) / c.ratings.length).toFixed(1),
                ratings: c.ratings,
              })).sort((a,b) => b.avg - a.avg);
              const allCount = classRatings.length;
              const overallAvg = allCount > 0 ? (classRatings.reduce((s,r) => s+r.rating, 0) / allCount).toFixed(1) : "—";
              return (
                <>
                  <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                    <div className="stat-card"><div className="stat-value">{allCount}</div><div className="stat-label">Ocen łącznie</div></div>
                    <div className="stat-card"><div className="stat-value" style={{ color: "var(--sage-dark)" }}>{overallAvg} ⭐</div><div className="stat-label">Średnia ogólna</div></div>
                    <div className="stat-card"><div className="stat-value">{classSummary.length}</div><div className="stat-label">Ocenionych zajęć</div></div>
                  </div>
                  {classSummary.length === 0
                    ? <div className="empty-state"><div className="empty-icon">⭐</div><p>Brak ocen</p></div>
                    : classSummary.map((c, i) => (
                      <div key={i} className="card" style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <div>
                            <h3 style={{ fontSize: "1rem", margin: 0 }}>{c.name}</h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{c.count} {c.count === 1 ? "ocena" : c.count < 5 ? "oceny" : "ocen"}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "1.5rem", fontFamily: "Cormorant Garamond, serif", color: "var(--sage-dark)", fontWeight: 600 }}>{c.avg} ⭐</div>
                            <div style={{ display: "flex", gap: "0.2rem", justifyContent: "flex-end" }}>
                              {[1,2,3,4,5].map(s => (
                                <span key={s} style={{ fontSize: "0.9rem", opacity: s <= Math.round(+c.avg) ? 1 : 0.25 }}>⭐</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {c.ratings.filter(r => r.comment).length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {c.ratings.filter(r => r.comment).map((r, j) => (
                              <div key={j} style={{ background: "var(--cream)", borderRadius: 6, padding: "0.6rem 0.75rem", fontSize: "0.85rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                  <span style={{ color: "var(--mid)", fontSize: "0.75rem" }}>{r.profiles?.first_name} {r.profiles?.last_name}</span>
                                  <span>{"⭐".repeat(r.rating)}</span>
                                </div>
                                <p style={{ margin: 0, color: "var(--charcoal)", fontStyle: "italic" }}>"{r.comment}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              );
            })()}
          </>
        )}

        {/* POWIADOMIENIA */}
        {tab === "notifications" && (
          <>
            <div className="page-header"><h2>{t("Powiadomienia", "Notifications")}</h2></div>

            {/* Masowe powiadomienia */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--charcoal)" }}>📢 {t("Wyślij wiadomość", "Send message")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Odbiorcy", "Recipients")}</label>
                  <select className="form-input" value={bulkMsgTarget} onChange={e => setBulkMsgTarget(e.target.value)}>
                    <option value="all">{t("Wszyscy klienci", "All clients")} ({allProfiles.filter(p => p.role === "client").length})</option>
                    <optgroup label={t("Uczestnicy zajęć", "Class participants")}>
                      {classes.slice().sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)).slice(0, 30).map(c => (
                        <option key={c.id} value={c.id}>{new Date(c.starts_at).toLocaleDateString(locale, { day: "numeric", month: "short" })} — {c.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Kanały", "Channels")}</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingTop: "0.3rem" }}>
                    {[["app", `📱 ${t("Powiadomienie w aplikacji","In-app notification")}`], ["push", `🔔 Push`], ["sms", `📱 SMS`]].map(([key, label]) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={bulkMsgChannels[key]} onChange={e => setBulkMsgChannels(p => ({ ...p, [key]: e.target.checked }))} style={{ accentColor: "var(--sage)" }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ margin: "0 0 0.75rem" }}>
                <label className="form-label">{t("Treść wiadomości", "Message")}</label>
                <textarea className="form-input" rows={3} placeholder={t("Wpisz treść wiadomości…","Write your message…")} value={bulkMsgText} onChange={e => setBulkMsgText(e.target.value)} style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={sendBulkMessage} disabled={!bulkMsgText.trim() || sendingBulk || (!bulkMsgChannels.app && !bulkMsgChannels.push && !bulkMsgChannels.sms)}>
                  {sendingBulk ? t("Wysyłanie…","Sending…") : t("Wyślij","Send")}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <h3 style={{ font: "inherit", fontWeight: 600 }}>{t("Historia powiadomień", "Notification history")}</h3>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {[
                  { key: "all", label: t("Wszystkie","All") },
                  { key: "unread", label: `${t("Nieprzeczytane","Unread")}${notifications.filter(n => !n.read).length > 0 ? ` (${notifications.filter(n => !n.read).length})` : ""}` },
                  { key: "class_cancelled", label: t("Odwołania","Cancellations") },
                  { key: "booking", label: t("Wiadomości","Messages") },
                  { key: "tokens_added", label: t("Wejścia","Credits") },
                ].map(f => (
                  <button key={f.key} onClick={() => setNotifFilter(f.key)}
                    className={`btn btn-sm ${notifFilter === f.key ? "btn-primary" : "btn-secondary"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
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
                ? <div className="empty-state"><div className="empty-icon">🔔</div><p>{t("Brak powiadomień","No notifications")}{notifFilter !== "all" ? t(" w tej kategorii"," in this category") : ""}.</p></div>
                : <div className="table-wrapper"><table><thead><tr><th>{t("Typ","Type")}</th><th>{t("Wiadomość","Message")}</th><th>{t("Kiedy","When")}</th></tr></thead><tbody>
                    {filtered.map(n => (
                      <tr key={n.id} style={{ background: n.read ? "transparent" : "rgba(138,158,133,0.06)" }}>
                        <td style={{ fontSize: "1.2rem" }}>{notifIcon(n.type)}</td>
                        <td style={{ fontWeight: n.read ? 400 : 500 }}>{n.message}</td>
                        <td style={{ color: "var(--mid)", whiteSpace: "nowrap" }}>{formatRelative(n.created_at)}</td>
                      </tr>
                    ))}
                  </tbody></table></div>;
            })()}
          </>
        )}

        {/* STATYSTYKI */}
        {tab === "stats" && (
          <>
            <div className="page-header"><h2>{t("Statystyki", "Statistics")}</h2></div>
            <div className="stats-row">
              <div className="stat-card"><div className="stat-value">{allBookings.length}</div><div className="stat-label">{t("Rezerwacji łącznie","Total bookings")}</div></div>
              <div className="stat-card"><div className="stat-value">{classes.length}</div><div className="stat-label">{t("Zajęć łącznie","Total classes")}</div></div>
              <div className="stat-card"><div className="stat-value">{stats.uniqueClients}</div><div className="stat-label">{t("Klientów","Clients")}</div></div>
            </div>
            <div className="section-header" style={{ marginBottom: "1rem" }}><h3>{t("Frekwencja wg dnia tygodnia","Attendance by weekday")}</h3></div>
            <div className="card" style={{ marginBottom: "2rem", padding: "1.5rem 1.5rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", height: 160 }}>
                {dayStats.map(d => (
                  <div key={d.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mid)" }}>{d.count}</span>
                    <div style={{ width: "100%", background: "var(--sage)", borderRadius: "4px 4px 0 0", height: `${(d.count / maxDay) * 120}px`, minHeight: d.count > 0 ? 8 : 0 }} />
                    <span style={{ fontSize: "0.75rem", color: "var(--mid)", fontWeight: 500 }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="section-header" style={{ marginBottom: "1rem" }}><h3>{t("Najpopularniejsze godziny","Most popular hours")}</h3></div>
            <div className="card">
              {topHours.length === 0 ? <p style={{ color: "var(--mid)" }}>{t("Brak danych","No data")}</p>
                : topHours.map(([hour, count], i) => (
                  <div key={hour} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.6rem 0", borderBottom: i < topHours.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span>{["🥇","🥈","🥉"][i]}</span>
                    <span style={{ fontWeight: 500 }}>{hour}:00 – {parseInt(hour)+1}:00</span>
                    <span style={{ marginLeft: "auto", color: "var(--mid)", fontSize: "0.875rem" }}>{count} {t("rezerwacji","bookings")}</span>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* HISTORIA */}
        {tab === "history" && (
          <>
            <div className="page-header"><h2>{t("Historia zajęć", "Class history")}</h2></div>
            {pastClasses.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div><p>{t("Brak minionych zajęć","No past classes")}</p></div>
              : <div className="table-wrapper"><table>
                <thead><tr><th>{t("Nazwa","Name")}</th><th>{t("Data","Date")}</th><th>{t("Cena","Price")}</th><th>{t("Uczestnicy","Participants")}</th><th></th></tr></thead>
                <tbody>{pastClasses.map(cls => {
                  const bookingsForClass = allBookings.filter(b => b.class_id === cls.id);
                  return (
                    <tr key={cls.id}>
                      <td><strong>{cls.name}</strong></td>
                      <td>{formatDate(cls.starts_at)}</td>
                      <td>{cls.price_pln ? `${cls.price_pln} zł` : "—"}</td>
                      <td>{bookingsForClass.length > 0 ? bookingsForClass.map(b => <span key={b.id} className="participant-chip">{b.profiles?.first_name} {b.profiles?.last_name}</span>) : <span style={{ color: "var(--light)", fontSize: "0.8rem" }}>{t("brak","none")}</span>}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => openEdit(cls)}>{t("Edytuj","Edit")}</button></td>
                    </tr>
                  );
                })}</tbody></table></div>}
          </>
        )}

        {/* KLIENCI */}
        {tab === "clients" && (
          <>
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h2>{t("Klienci","Clients")}</h2></div>
              <button className="btn btn-primary btn-sm" onClick={() => { setNewClientContext("clients"); setShowNewClientModal(true); }}>+ {t("Nowy klient","New client")}</button>
            </div>

            {/* Wyszukiwarka */}
            <div style={{ marginBottom: "1.25rem" }}>
              <input
                className="form-input"
                placeholder={t("🔍 Szukaj po imieniu lub nazwisku...","🔍 Search by name...")}
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                style={{ maxWidth: 360 }}
              />
            </div>

            {allProfiles.length === 0 ? <div className="empty-state"><div className="empty-icon">👥</div><p>{t("Brak klientów","No clients")}</p></div>
              : (() => {
                const filtered = allProfiles.filter(c =>
                  `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.email?.toLowerCase().includes(clientSearch.toLowerCase())
                );
                return filtered.length === 0
                  ? <div className="empty-state"><div className="empty-icon">🔍</div><p>Brak wyników dla "{clientSearch}"</p></div>
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {filtered.map((c, i) => (
                        <div key={i} className="card" style={{ padding: "1rem 1.25rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <div className="user-avatar">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{c.first_name} {c.last_name}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{c.email}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--mid)", marginTop: 2 }}>
                                  {t("Rezerwacji:","Bookings:")} {allBookings.filter(b => b.user_id === c.id).length}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              <TokenBadge userId={c.id} month={currentMonth} year={currentYear} />
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditClient(c)}>✏️ {t("Edytuj","Edit")}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openUserTokens(c)}>🎫 {t("Wejścia","Credits")}</button>
                            </div>
                          </div>

                          {/* Statystyki klienta */}
                          {(() => {
                            const cBookings = allBookings.filter(b => b.user_id === c.id);
                            const pastBookings = cBookings.filter(b => new Date(b.classes?.starts_at) < new Date());
                            const nameCounts = {};
                            cBookings.forEach(b => { const n = b.classes?.name; if (n) nameCounts[n] = (nameCounts[n] || 0) + 1; });
                            const favorite = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                            const entriesUsed = tokenHistory.filter(h => h.user_id === c.id && h.operation === "use" && new Date(h.created_at).getFullYear() === currentYear).length;
                            return (
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                                <span style={{ fontSize: "0.72rem", background: "var(--cream)", color: "var(--mid)", padding: "0.2rem 0.55rem", borderRadius: 20 }}>📅 {pastBookings.length} {t("odbytych","attended")}</span>
                                {favorite && <span style={{ fontSize: "0.72rem", background: "var(--cream)", color: "var(--mid)", padding: "0.2rem 0.55rem", borderRadius: 20 }}>⭐ {favorite}</span>}
                                {entriesUsed > 0 && <span style={{ fontSize: "0.72rem", background: "var(--cream)", color: "var(--mid)", padding: "0.2rem 0.55rem", borderRadius: 20 }}>🎫 {entriesUsed} {t("wejść w","credits in")} {currentYear}</span>}
                                {cBookings.filter(b => b.payment_method === "cash").length > 0 && <span style={{ fontSize: "0.72rem", background: "var(--cream)", color: "var(--mid)", padding: "0.2rem 0.55rem", borderRadius: 20 }}>💵 {cBookings.filter(b => b.payment_method === "cash").length} {t("gotówką","cash")}</span>}
                              </div>
                            );
                          })()}

                          {/* Notatki admina */}
                          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                            {editingNotes === c.id ? (
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                <textarea
                                  className="form-input"
                                  value={notesText}
                                  onChange={e => setNotesText(e.target.value)}
                                  placeholder="np. kontuzja kolana, preferuje rano, alergia na lateks..."
                                  rows={2}
                                  style={{ flex: 1, resize: "vertical", fontSize: "0.85rem" }}
                                  autoFocus
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                  <button className="btn btn-primary btn-sm" onClick={() => saveNotes(c.id)}>{t("Zapisz","Save")}</button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingNotes(null)}>{t("Anuluj","Cancel")}</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                                <div style={{ flex: 1 }}>
                                  {c.admin_notes
                                    ? <p style={{ fontSize: "0.85rem", color: "var(--charcoal)", fontStyle: "italic" }}>📝 {c.admin_notes}</p>
                                    : <p style={{ fontSize: "0.8rem", color: "var(--light)" }}>{t("Brak notatek","No notes")}</p>}
                                </div>
                                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}
                                  onClick={() => { setEditingNotes(c.id); setNotesText(c.admin_notes || ""); }}>
                                  {c.admin_notes ? t("Edytuj notatkę","Edit note") : t("Dodaj notatkę","Add note")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
              })()}
          </>
        )}

        {tab === "admin_account" && (
          <>
            <div className="page-header"><h2>{t("Konto","Account")}</h2></div>
            <div className="card" style={{ maxWidth: 420 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className="user-avatar" style={{ width: 52, height: 52, fontSize: "1.2rem" }}>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{profile?.first_name} {profile?.last_name}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{t("Administrator","Administrator")}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--mid)" }}>{profile?.email}</div>
                </div>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="btn btn-secondary btn-full" style={{ marginBottom: "0.75rem" }}>
                {darkMode ? `☀️ ${t("Tryb jasny","Light mode")}` : `🌙 ${t("Tryb ciemny","Dark mode")}`}
              </button>
              <button className="btn btn-danger btn-full" onClick={() => supabase.auth.signOut()}>{t("Wyloguj się","Log out")}</button>
            </div>
          </>
        )}

        {/* PRACOWNICY */}
        {tab === "staff" && multiStaff && (
          <>
            <div className="page-header"><h2>{t("Pracownicy","Staff")}</h2></div>
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>{editingStaff ? t("Edytuj pracownika","Edit staff member") : t("Dodaj pracownika","Add staff member")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "flex-end" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Imię i nazwisko","Full name")}</label>
                  <input className="form-input" placeholder={t("np. Anna Kowalska","e.g. Anna Smith")} value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Kolor","Color")}</label>
                  <input type="color" value={staffForm.color} onChange={e => setStaffForm({ ...staffForm, color: e.target.value })}
                    style={{ width: 46, height: 40, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", padding: 2 }} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" onClick={handleSaveStaff} disabled={!staffForm.name.trim()}>{editingStaff ? t("Zapisz","Save") : t("Dodaj","Add")}</button>
                  {editingStaff && <button className="btn btn-secondary" onClick={() => { setEditingStaff(null); setStaffForm({ name: "", color: "#8A9E85" }); }}>{t("Anuluj","Cancel")}</button>}
                </div>
              </div>
            </div>
            {staff.length === 0
              ? <div className="empty-state"><div className="empty-icon">🧑‍💼</div><p>{t("Brak pracowników. Dodaj pierwszego powyżej.","No staff members. Add the first one above.")}</p></div>
              : <div className="table-wrapper">
                <table>
                  <thead><tr><th>{t("Pracownik","Staff member")}</th><th>{t("Status","Status")}</th><th>{t("Akcje","Actions")}</th></tr></thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                            <strong>{s.name}</strong>
                          </span>
                        </td>
                        <td><span style={{ fontSize: "0.8rem", color: s.active ? "var(--sage-dark)" : "var(--light)" }}>{s.active ? t("Aktywny","Active") : t("Nieaktywny","Inactive")}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingStaff(s); setStaffForm({ name: s.name, color: s.color }); }}>{t("Edytuj","Edit")}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleStaff(s)}>{s.active ? t("Dezaktywuj","Deactivate") : t("Aktywuj","Activate")}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStaff(s.id)}>{t("Usuń","Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
          </>
        )}

        {/* USŁUGI */}
        {tab === "services" && hasServices && (
          <>
            <div className="page-header"><h2>{t("Usługi i cennik","Services & pricing")}</h2></div>
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>{editingService ? t("Edytuj usługę","Edit service") : t("Dodaj usługę","Add service")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "0.75rem", alignItems: "flex-end" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Nazwa usługi","Service name")}</label>
                  <input className="form-input" placeholder={t("np. Strzyżenie damskie","e.g. Women's haircut")} value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Czas (min)","Duration (min)")}</label>
                  <input className="form-input" type="number" min="15" max="480" step="15" value={serviceForm.duration_min} onChange={e => setServiceForm({ ...serviceForm, duration_min: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Cena (zł)","Price (PLN)")}</label>
                  <input className="form-input" type="number" min="0" placeholder={t("np. 120","e.g. 120")} value={serviceForm.price_pln} onChange={e => setServiceForm({ ...serviceForm, price_pln: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" onClick={handleSaveService} disabled={!serviceForm.name.trim()}>{editingService ? t("Zapisz","Save") : t("Dodaj","Add")}</button>
                  {editingService && <button className="btn btn-secondary" onClick={() => { setEditingService(null); setServiceForm({ name: "", duration_min: 60, price_pln: "" }); }}>{t("Anuluj","Cancel")}</button>}
                </div>
              </div>
            </div>

            {services.length === 0
              ? <div className="empty-state"><div className="empty-icon">🛠</div><p>{t("Brak usług. Dodaj pierwszą powyżej.","No services. Add the first one above.")}</p></div>
              : <div className="table-wrapper">
                  <table>
                    <thead><tr><th>{t("Usługa","Service")}</th><th>{t("Czas","Duration")}</th><th>{t("Cena","Price")}</th><th>{t("Status","Status")}</th><th>{t("Akcje","Actions")}</th></tr></thead>
                    <tbody>
                      {services.map(s => (
                        <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td>{s.duration_min} min</td>
                          <td>{s.price_pln > 0 ? `${s.price_pln} zł` : "—"}</td>
                          <td>
                            <span style={{ fontSize: "0.78rem", padding: "0.15rem 0.5rem", borderRadius: 4, background: s.active ? "#EBF5EA" : "#F0F0F0", color: s.active ? "var(--sage-dark)" : "var(--mid)" }}>
                              {s.active ? t("Aktywna","Active") : t("Nieaktywna","Inactive")}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingService(s); setServiceForm({ name: s.name, duration_min: s.duration_min, price_pln: s.price_pln || "" }); }}>{t("Edytuj","Edit")}</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleToggleService(s)}>{s.active ? t("Dezaktywuj","Deactivate") : t("Aktywuj","Activate")}</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteService(s.id)}>{t("Usuń","Delete")}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </>
        )}

        {/* USTAWIENIA STUDIA */}
        {tab === "studio_settings" && studioSettings && (() => {
          const ro = isDemo; // read-only flag dla demo
          return (<>
            <div className="page-header">
              <h2>{t("Moje studio","My studio")}</h2>
              {ro && (
                <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.9rem", fontSize: "0.82rem", color: "var(--mid)" }}>
                  👁 {t("Tryb podglądu — ustawienia są tylko do wglądu","Preview mode — settings are read-only")}
                </div>
              )}
            </div>

            {/* Podstawowe */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Podstawowe","General")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Nazwa studia","Studio name")}</label>
                  <input className="form-input" disabled={ro} value={studioSettings.name} onChange={e => setStudioSettings(s => ({ ...s, name: e.target.value }))} placeholder={t("np. Studio Roberta","e.g. Robert's Studio")} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Nazwa w nawigacji","Nav name")} <span style={{ color: "var(--mid)", fontSize: "0.75rem" }}>({t("skrócona","short")})</span></label>
                  <input className="form-input" disabled={ro} value={studioSettings.nav_name} onChange={e => setStudioSettings(s => ({ ...s, nav_name: e.target.value }))} placeholder={t("np. Studio Roberta","e.g. Robert's Studio")} />
                </div>
              </div>
            </div>

            {/* Branża */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Branża i funkcje","Industry & features")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Zajęcia vs Usługi */}
                <div style={{ marginBottom: "0.25rem" }}>
                  <div style={{ fontWeight: 500, marginBottom: "0.4rem" }}>{t("Typ działalności","Business type")}</div>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    {[[
                      "classes",
                      t("Zajęcia","Classes"),
                      t("Pilates, joga, siłownia — grupowe i indywidualne","Pilates, yoga, gym — group and individual")
                    ], [
                      "services",
                      t("Usługi","Services"),
                      t("Fryzjer, gabinet, warsztat — wizyty z cennikiem","Hairdresser, clinic, workshop — appointments with pricing")
                    ]].map(([val, label, desc]) => (
                      <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", flex: 1, background: studioSettings.service_mode === val ? "var(--cream)" : "transparent", border: `1px solid ${studioSettings.service_mode === val ? "var(--sage)" : "var(--border)"}`, borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                        <input type="radio" name="service_mode" value={val} checked={studioSettings.service_mode === val} onChange={() => setStudioSettings(s => ({ ...s, service_mode: val }))} style={{ marginTop: "0.2rem", accentColor: "var(--sage)" }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--mid)" }}>{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: ro ? "default" : "pointer" }}>
                  <input type="checkbox" style={{ marginTop: "0.2rem" }} disabled={ro} checked={studioSettings.tokens_enabled} onChange={e => setStudioSettings(s => ({ ...s, tokens_enabled: e.target.checked }))} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{t("Karnety wejść","Entry passes")}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--mid)" }}>{t("Włącz dla pilates, jogi, siłowni. Wyłącz dla fryzjerów, warsztatów, gabinetów.","Enable for pilates, yoga, gym. Disable for hairdressers, workshops, clinics.")}</div>
                  </div>
                </label>
                {studioSettings.service_mode === "services" && (
                  <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>{t("Opcje trybu usług","Service mode options")}</div>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: ro ? "default" : "pointer" }}>
                      <input type="checkbox" style={{ marginTop: "0.2rem" }} disabled={ro} checked={studioSettings.multi_staff} onChange={e => setStudioSettings(s => ({ ...s, multi_staff: e.target.checked }))} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{t("Wielu pracowników","Multiple staff")}</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--mid)" }}>{t("Oddzielne kolumny w kalendarzu i zakładka Pracownicy do zarządzania. Wyłącz dla jednoosobowej działalności.","Separate columns in calendar and a Staff tab to manage. Disable for solo businesses.")}</div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Wygląd */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Wygląd","Appearance")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                {[
                  { key: "color_sage", label: t("Kolor główny","Primary color"), desc: t("przyciski, akcenty","buttons, accents") },
                  { key: "color_clay", label: t("Kolor drugorzędny","Secondary color"), desc: t("tagi, oznaczenia","tags, labels") },
                  { key: "color_cream", label: t("Tło","Background"), desc: t("główne tło aplikacji","main app background") },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{label} <span style={{ color: "var(--mid)", fontSize: "0.72rem" }}>({desc})</span></label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input type="color" disabled={ro} value={studioSettings[key]} onChange={e => setStudioSettings(s => ({ ...s, [key]: e.target.value }))}
                        style={{ width: 40, height: 36, border: "1px solid var(--border)", borderRadius: 6, cursor: ro ? "default" : "pointer", padding: 2, opacity: ro ? 0.6 : 1 }} />
                      <input className="form-input" disabled={ro} value={studioSettings[key]} onChange={e => setStudioSettings(s => ({ ...s, [key]: e.target.value }))}
                        style={{ fontFamily: "monospace", fontSize: "0.85rem" }} placeholder="#8A9E85" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t("Logo","Logo")}</label>
                {(studioSettings.logo_url || studioLogoFile) && (
                  <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {studioSettings.logo_url && !studioLogoFile && <img src={studioSettings.logo_url} alt="logo" style={{ height: 44, objectFit: "contain" }} />}
                    {studioLogoFile && <span style={{ fontSize: "0.85rem", color: "var(--mid)" }}>{t("Nowy plik:","New file:")} {studioLogoFile.name}</span>}
                    {studioSettings.logo_url && !ro && <button className="btn btn-secondary btn-sm" onClick={() => { setStudioSettings(s => ({ ...s, logo_url: "" })); setStudioLogoFile(null); }}>{t("Usuń logo","Remove logo")}</button>}
                  </div>
                )}
                {!ro && <input type="file" accept="image/*" onChange={e => setStudioLogoFile(e.target.files[0])} style={{ fontSize: "0.85rem" }} />}
              </div>
            </div>

            {/* Opisy */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Opisy strony głównej","Homepage copy")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  { key: "hero_eyebrow", label: t("Nadtytuł","Eyebrow"), placeholder: t("np. Twoje miejsce na ziemi","e.g. Your place on earth") },
                  { key: "hero_title", label: t("Główny nagłówek","Main heading"), placeholder: t("np. Pilates w centrum Warszawy","e.g. Pilates in the city centre") },
                  { key: "hero_sub", label: t("Podtytuł hero","Hero subheading"), placeholder: t("np. Zajęcia dla każdego poziomu...","e.g. Classes for every level...") },
                  { key: "cta_title", label: t("Tytuł sekcji CTA","CTA section title"), placeholder: t("np. Zacznij już dziś","e.g. Get started today") },
                  { key: "cta_sub", label: t("Opis CTA","CTA description"), placeholder: t("np. Pierwsze zajęcia gratis...","e.g. First class free...") },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{label}</label>
                    <input className="form-input" disabled={ro} value={studioSettings[key]} onChange={e => setStudioSettings(s => ({ ...s, [key]: e.target.value }))} placeholder={placeholder} />
                  </div>
                ))}
              </div>
            </div>

            {/* Kontakt i SEO */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Kontakt i powiadomienia","Contact & notifications")}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Email nadawcy","Sender email")}</label>
                  <input className="form-input" disabled={ro} type="email" value={studioSettings.email_from} onChange={e => setStudioSettings(s => ({ ...s, email_from: e.target.value }))} placeholder="noreply@yourdomain.com" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("URL aplikacji","App URL")}</label>
                  <input className="form-input" disabled={ro} value={studioSettings.app_url} onChange={e => setStudioSettings(s => ({ ...s, app_url: e.target.value }))} placeholder="https://yourdomain.com" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Podpis SMS","SMS signature")}</label>
                  <input className="form-input" disabled={ro} value={studioSettings.sms_signature} onChange={e => setStudioSettings(s => ({ ...s, sms_signature: e.target.value }))} placeholder={t("np. Studio Roberta","e.g. Robert's Studio")} />
                </div>
              </div>
            </div>

            {/* Płatności online */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Płatności online","Online payments")}</h3>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: ro ? "default" : "pointer", marginBottom: "0.75rem" }}>
                <input type="checkbox" style={{ marginTop: "0.2rem" }}
                  checked={studioSettings.payments_online}
                  disabled={ro}
                  onChange={e => setStudioSettings(s => ({ ...s, payments_online: e.target.checked }))} />
                <div>
                  <div style={{ fontWeight: 500 }}>{t("Włącz płatności online","Enable online payments")}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--mid)" }}>{t("Klienci będą mogli płacić za zajęcia przez internet przy zapisie.","Clients will be able to pay for classes online when booking.")}</div>
                </div>
              </label>
              {studioSettings.payments_online && (
                <div style={{ marginLeft: "1.75rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>{t("Operator płatności","Payment provider")}</div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    {[["p24", "Przelewy24", t("Polska — przelewy, BLIK, karty","Poland — transfers, BLIK, cards")], ["stripe", "Stripe", t("Międzynarodowy — karty kredytowe","International — credit cards")]].map(([val, name, desc]) => (
                      <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: ro ? "default" : "pointer", flex: 1, background: studioSettings.payment_provider === val ? "var(--cream)" : "transparent", border: `1px solid ${studioSettings.payment_provider === val ? "var(--sage)" : "var(--border)"}`, borderRadius: 8, padding: "0.6rem 0.75rem" }}>
                        <input type="radio" name="payment_provider" value={val}
                          checked={studioSettings.payment_provider === val}
                          disabled={ro}
                          onChange={() => setStudioSettings(s => ({ ...s, payment_provider: val }))}
                          style={{ marginTop: "0.2rem", accentColor: "var(--sage)" }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--mid)" }}>{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!ro && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleSaveStudioSettings} disabled={studioSettingsSaving}>
                  {studioSettingsSaving ? t("Zapisywanie...","Saving...") : t("Zapisz ustawienia","Save settings")}
                </button>
              </div>
            )}
          </>);
        })()}

      </main>

      {/* Mobile nav */}
      <nav className="mobile-nav">
        <div className={`mobile-nav-item ${tab === "classes" || tab === "admin_calendar" ? "active" : ""}`} onClick={() => switchTab("admin_calendar")}><span className="mobile-nav-icon">📅</span><span>{t("Kalendarz","Calendar")}</span></div>
        <div className={`mobile-nav-item ${tab === "settle" ? "active" : ""}`} onClick={() => switchTab("settle")}>
          <span className="mobile-nav-icon" style={{ position: "relative" }}>💰{toSettle.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--clay)", color: "white", borderRadius: "50%", width: 14, height: 14, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{toSettle.length}</span>}</span>
          <span>{t("Rozlicz","Settle")}</span>
        </div>
        <div className={`mobile-nav-item ${tab === "reports" ? "active" : ""}`} onClick={() => switchTab("reports")}><span className="mobile-nav-icon">📈</span><span>{t("Raporty","Reports")}</span></div>
        <div className={`mobile-nav-item ${tab === "clients" ? "active" : ""}`} onClick={() => switchTab("clients")}><span className="mobile-nav-icon">👥</span><span>{t("Klienci","Clients")}</span></div>
        <div className={`mobile-nav-item ${tab === "admin_account" ? "active" : ""}`} onClick={() => switchTab("admin_account")}><span className="mobile-nav-icon">👤</span><span>{t("Konto","Account")}</span></div>
      </nav>

      {/* MODAL - Edycja klienta */}
      {editingClient && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingClient(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{t("Edytuj klienta","Edit client")}</h3>
              <button className="modal-close" onClick={() => setEditingClient(null)}>×</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", padding: "0.75rem", background: "var(--cream)", borderRadius: 8 }}>
              <div className="user-avatar">{clientForm.first_name?.[0]}{clientForm.last_name?.[0]}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--mid)" }}>{editingClient.email}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">{t("Imię","First name")}</label><input className="form-input" value={clientForm.first_name} onChange={e => setClientForm({ ...clientForm, first_name: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t("Nazwisko","Last name")}</label><input className="form-input" value={clientForm.last_name} onChange={e => setClientForm({ ...clientForm, last_name: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">{t("Telefon","Phone")}</label><input className="form-input" type="tel" placeholder="+48 500 000 000" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{t("Data urodzin","Birthday")}</label><input className="form-input" type="date" value={clientForm.birth_date} onChange={e => setClientForm({ ...clientForm, birth_date: e.target.value })} /></div>
            <div className="form-group">
              <label className="form-label">{t("Rola","Role")}</label>
              <select className="form-input" value={clientForm.role} onChange={e => setClientForm({ ...clientForm, role: e.target.value })}>
                <option value="client">{t("Klient","Client")}</option>
                <option value="admin">{t("Administrator","Administrator")}</option>
              </select>
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditingClient(null)}>{t("Anuluj","Cancel")}</button>
              <button className="btn btn-primary" onClick={saveEditClient} disabled={!clientForm.first_name || !clientForm.last_name}>{t("Zapisz","Save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Nowe/edytuj zajęcia */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editClass ? t("Edytuj zajęcia","Edit class") : t("Nowe zajęcia","New class")}</h3><button className="modal-close" onClick={() => setShowModal(false)}>×</button></div>
            {!editClass && templates.length > 0 && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "1rem" }}>
                <label className="form-label" style={{ marginBottom: "0.5rem", display: "block" }}>{t("Wczytaj szablon","Load template")}</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {templates.map(t => (
                    <button key={t.id} className="btn btn-secondary btn-sm" onClick={() => applyTemplate(t)}>📋 {t.name}</button>
                  ))}
                </div>
              </div>
            )}
            {hasServices && services.filter(s => s.active).length > 0 && !editClass && (
              <div className="form-group" style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}>
                <label className="form-label">{t("Wybierz usługę (opcjonalnie)","Select service (optional)")}</label>
                <select className="form-input" defaultValue="" onChange={e => {
                  const svc = services.find(s => s.id === e.target.value);
                  if (svc) setForm(f => ({ ...f, name: svc.name, duration_min: svc.duration_min, price_pln: svc.price_pln || "", max_spots: 1 }));
                }}>
                  <option value="">{t("— Wpisz ręcznie —","— Enter manually —")}</option>
                  {services.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · {s.price_pln > 0 ? `${s.price_pln} zł` : t("bezpłatna","free")}</option>
                  ))}
                </select>
              </div>
            )}
            {multiStaff && (
              <div className="form-group">
                <label className="form-label">{t("Pracownik","Staff member")}</label>
                <select className="form-input" value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
                  <option value="">{t("— Brak przypisania —","— Unassigned —")}</option>
                  {staff.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label className="form-label">{t("Nazwa","Name")}{hasServices ? t(" wizyty/usługi"," / service") : t(" zajęć"," of class")}</label><input className="form-input" placeholder={hasServices ? t("np. Strzyżenie damskie","e.g. Women's haircut") : t("np. Pilates Flow","e.g. Pilates Flow")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{t("Data i godzina","Date and time")}</label><input className="form-input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">{t("Czas (min)","Duration (min)")}</label><input className="form-input" type="number" min="15" max="180" step="15" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t("Maks. miejsc","Max spots")}</label><input className="form-input" type="number" min="1" max="50" value={form.max_spots} onChange={e => setForm({ ...form, max_spots: +e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">{t("Cena (zł)","Price (PLN)")}</label><input className="form-input" type="number" min="0" placeholder={t("np. 60","e.g. 60")} value={form.price_pln} onChange={e => setForm({ ...form, price_pln: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t("Koszt sali (zł)","Venue cost (PLN)")}</label><input className="form-input" type="number" min="0" placeholder={t("np. 100","e.g. 100")} value={form.venue_cost_pln} onChange={e => setForm({ ...form, venue_cost_pln: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">{t("Lokalizacja","Location")}</label><input className="form-input" placeholder={t("np. Sala A","e.g. Room A")} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{t("Notatki dla klientek","Notes for clients")}</label><input className="form-input" placeholder={t("np. Przynieś matę","e.g. Bring a mat")} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            {/* Edycja serii — tylko przy edytowaniu zajęć z series_id */}
            {editClass && editClass.series_id && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={editSeriesAll} onChange={e => setEditSeriesAll(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--sage)" }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>🔁 {t("Edytuj wszystkie zajęcia z tej serii","Edit all classes in this series")}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>{t("Nazwa, czas, miejsca, cena i notatki zostaną zmienione we wszystkich — daty pozostaną bez zmian","Name, duration, spots, price and notes will be changed for all — dates will remain unchanged")}</div>
                  </div>
                </label>
              </div>
            )}

            {/* Zajęcia cykliczne — tylko przy tworzeniu */}
            {!editClass && (
              <div style={{ background: "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", marginBottom: recurring.enabled ? "0.75rem" : 0 }}>
                  <input type="checkbox" checked={recurring.enabled} onChange={e => setRecurring({ ...recurring, enabled: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--sage)" }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>🔁 {t("Zajęcia cykliczne","Recurring classes")}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--mid)" }}>{t("Powtarzaj co tydzień o tej samej godzinie","Repeat weekly at the same time")}</div>
                  </div>
                </label>
                {recurring.enabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--mid)" }}>{t("Powtórz przez","Repeat for")}</span>
                    <input type="number" min="2" max="52" value={recurring.weeks}
                      onChange={e => setRecurring({ ...recurring, weeks: +e.target.value })}
                      style={{ width: 70, padding: "0.4rem 0.6rem", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "DM Sans, sans-serif", fontSize: "0.875rem" }} />
                    <span style={{ fontSize: "0.875rem", color: "var(--mid)" }}>{t("tygodni","weeks")}</span>
                    <span style={{ fontSize: "0.8rem", background: "#EBF5EA", color: "var(--sage-dark)", padding: "0.2rem 0.6rem", borderRadius: 20 }}>= {recurring.weeks} zajęć</span>
                  </div>
                )}
              </div>
            )}
            {/* Zarządzanie uczestnikami — tylko przy edycji istniejących zajęć */}
            {editClass && (() => {
              const classBookings = allBookings.filter(b => b.class_id === editClass.id);
              const bookedUserIds = new Set(classBookings.map(b => b.user_id));
              const availableProfiles = allProfiles.filter(p => p.role === "client" && !bookedUserIds.has(p.id));
              return (
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "1rem", paddingTop: "1rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                    {t("Uczestnicy","Participants")} ({classBookings.length}/{editClass.max_spots})
                  </div>
                  {classBookings.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
                      {classBookings.map(b => (
                        <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--cream)", borderRadius: 7, padding: "0.4rem 0.75rem" }}>
                          <span style={{ fontSize: "0.85rem" }}>{b.profiles?.first_name} {b.profiles?.last_name}
                            <span style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "var(--mid)" }}>{b.payment_method === "entries" ? "🎫" : "💵"}</span>
                          </span>
                          <button className="btn btn-danger btn-sm" style={{ padding: "0.2rem 0.5rem", fontSize: "0.72rem" }} onClick={() => handleRemoveParticipant(b.id)}>{t("Usuń","Remove")}</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {availableProfiles.length > 0 && (
                      <>
                        <select className="form-input" style={{ flex: 1, minWidth: 140 }} value={addParticipantId} onChange={e => setAddParticipantId(e.target.value)}>
                          <option value="">{t("Wybierz uczestnika…","Select participant…")}</option>
                          {availableProfiles.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                        </select>
                        <select className="form-input" style={{ width: 110 }} value={addParticipantMethod} onChange={e => setAddParticipantMethod(e.target.value)}>
                          <option value="cash">💵 {t("Gotówka","Cash")}</option>
                          {tokensEnabled && <option value="entries">🎫 {t("Wejście","Credit")}</option>}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={handleAddParticipant} disabled={!addParticipantId || addingParticipant}>
                          {addingParticipant ? "…" : `+ ${t("Dodaj","Add")}`}
                        </button>
                      </>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => { setNewClientContext("class"); setShowNewClientModal(true); }}>+ {t("Nowy klient","New client")}</button>
                  </div>
                </div>
              );
            })()}

            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t("Anuluj","Cancel")}</button>
                {!editClass && <button className="btn btn-secondary" onClick={() => { setShowModal(false); setTemplateForm({ name: form.name, duration_min: form.duration_min, max_spots: form.max_spots, location: form.location, notes: form.notes, price_pln: form.price_pln, venue_cost_pln: form.venue_cost_pln }); setShowTemplateModal(true); }} title={t("Zapisz jako szablon","Save as template")}>📋 {t("Szablon","Template")}</button>}
                {editClass && <button className="btn btn-danger btn-sm" onClick={() => { setShowModal(false); setShowCancelModal(editClass); }}>🚫 {t("Odwołaj","Cancel class")}</button>}
                {editClass && <button className="btn btn-danger btn-sm" onClick={() => { setShowModal(false); handleDelete(editClass.id); }}>🗑 {t("Usuń","Delete")}</button>}
              </div>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.starts_at}>{editClass ? t("Zapisz","Save") : t("Utwórz","Create")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Odwołanie zajęć */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCancelModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>🚫 {t("Odwołaj zajęcia","Cancel class")}</h3><button className="modal-close" onClick={() => setShowCancelModal(null)}>×</button></div>
            <div style={{ background: "#FDE8E8", border: "1px solid #F5C6C6", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#C44B4B", lineHeight: 1.6 }}>
                {t("Odwołujesz zajęcia:","You are cancelling:")} <strong>{showCancelModal.name}</strong><br/>
                {formatDate(showCancelModal.starts_at)} {t("o","at")} {formatTime(showCancelModal.starts_at)}<br/>
                {t("Zapisanych:","Enrolled:")} <strong>{allBookings.filter(b => b.class_id === showCancelModal.id).length} {t("uczestników","participants")}</strong><br/>
                {t("Wejścia zostaną automatycznie zwrócone.","Credits will be automatically refunded.")}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">{t("Powód odwołania","Cancellation reason")}</label>
              <input className="form-input" placeholder={t("np. Choroba instruktora, awaria sali...","e.g. Instructor illness, venue issue...")} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowCancelModal(null); setCancelReason(""); }}>{t("Anuluj","Cancel")}</button>
              <button className="btn btn-danger" onClick={() => handleCancelClass(showCancelModal)} disabled={!cancelReason.trim()}>
                {t("Odwołaj i powiadom uczestników","Cancel and notify participants")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Nowy klient */}
      {showNewClientModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewClientModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>+ {t("Nowy klient","New client")}</h3>
              <button className="modal-close" onClick={() => setShowNewClientModal(false)}>×</button>
            </div>
            {newClientContext === "class" && editClass && (
              <p style={{ fontSize: "0.85rem", color: "var(--mid)", marginBottom: "1rem" }}>
                {t("Konto zostanie utworzone i klient zostanie od razu zapisany na","Account will be created and client will be booked into")} <strong>{editClass.name}</strong>.
              </p>
            )}
            <div className="form-group">
              <label className="form-label">{t("Imię","First name")} *</label>
              <input className="form-input" value={newClientForm.first_name} onChange={e => setNewClientForm(f => ({ ...f, first_name: e.target.value }))} placeholder={t("np. Anna","e.g. Anna")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t("Nazwisko","Last name")} *</label>
              <input className="form-input" value={newClientForm.last_name} onChange={e => setNewClientForm(f => ({ ...f, last_name: e.target.value }))} placeholder={t("np. Kowalska","e.g. Smith")} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={newClientForm.email} onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. anna@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">{t("Telefon","Phone")}</label>
              <input className="form-input" value={newClientForm.phone} onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))} placeholder={t("np. 600 100 200","e.g. +44 7700 900000")} />
            </div>
            <div className="form-group">
              <label className="form-label">{t("Data urodzenia","Birth date")}</label>
              <input className="form-input" type="date" value={newClientForm.birth_date} onChange={e => setNewClientForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
            {newClientContext === "class" && editClass && (
              <div className="form-group">
                <label className="form-label">{t("Metoda płatności","Payment method")}</label>
                <select className="form-input" value={addParticipantMethod} onChange={e => setAddParticipantMethod(e.target.value)}>
                  <option value="cash">💵 {t("Gotówka","Cash")}</option>
                  <option value="entries">🎫 {t("Wejście","Credit")}</option>
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewClientModal(false)}>{t("Anuluj","Cancel")}</button>
              <button className="btn btn-primary" onClick={handleCreateNewClient} disabled={newClientLoading}>
                {newClientLoading ? t("Tworzenie…","Creating…") : t("Utwórz konto","Create account")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Wiadomość do uczestników */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMessageModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>💬 {t("Wiadomość do uczestników","Message to participants")}</h3><button className="modal-close" onClick={() => setShowMessageModal(null)}>×</button></div>
            <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>
              {t("Zajęcia:","Class:")} <strong>{showMessageModal.name}</strong><br/>
              {formatDate(showMessageModal.starts_at)} {t("o","at")} {formatTime(showMessageModal.starts_at)}<br/>
              {t("Odbiorców:","Recipients:")} <strong>{allBookings.filter(b => b.class_id === showMessageModal.id).length}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">{t("Wiadomość","Message")}</label>
              <textarea className="form-input" rows={4} placeholder={t("np. Przypomnij o zabraniu maty, zmiana sali na B, zajęcia zaczynamy 10 min później...","e.g. Reminder to bring a mat, room change to B, class starts 10 min later...")}
                value={messageText} onChange={e => setMessageText(e.target.value)}
                style={{ resize: "vertical", minHeight: 100 }} />
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ marginBottom: "0.6rem", display: "block" }}>{t("Kanały wysyłki","Delivery channels")}</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  { key: "app", label: `📱 ${t("Powiadomienie w aplikacji","In-app notification")}`, always: true },
                  { key: "email", label: "✉️ Email" },
                  { key: "sms", label: `💬 SMS (${t("tylko osoby z numerem","only users with phone number")})` },
                ].map(ch => (
                  <label key={ch.key} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.875rem", cursor: ch.always ? "default" : "pointer" }}>
                    <input type="checkbox" checked={msgDelivery[ch.key]}
                      disabled={ch.always}
                      onChange={e => setMsgDelivery(prev => ({ ...prev, [ch.key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: "var(--sage)" }} />
                    {ch.label}{ch.always && <span style={{ fontSize: "0.75rem", color: "var(--light)", marginLeft: 4 }}>({t("zawsze","always")})</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowMessageModal(null); setMessageText(""); setMsgDelivery({ app: true, email: false, sms: false }); }}>{t("Anuluj","Cancel")}</button>
              <button className="btn btn-primary" onClick={() => handleSendMessage(showMessageModal)} disabled={!messageText.trim()}>
                {t("Wyślij do wszystkich","Send to all")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Wejścia */}
      {showTokenModal && selectedUser && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTokenModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3>🎫 {t("Wejścia","Credits")} — {selectedUser.first_name} {selectedUser.last_name}</h3><button className="modal-close" onClick={() => setShowTokenModal(false)}>×</button></div>
            <div style={{ marginBottom: "1.5rem" }}>
              <p className="form-label" style={{ marginBottom: "0.75rem" }}>{t("Saldo","Balance")}</p>
              {userTokens.length === 0 ? <p style={{ color: "var(--mid)", fontSize: "0.875rem" }}>{t("Brak wejść","No credits")}</p>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {userTokens.map(t => (
                    <div key={t.id} style={{ background: t.amount > 0 ? "#EBF5EA" : "var(--cream)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 1rem", textAlign: "center" }}>
                      <div style={{ fontSize: "1.4rem", fontFamily: "Cormorant Garamond, serif", color: t.amount > 0 ? "var(--sage-dark)" : "var(--light)" }}>{t.amount}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--mid)", textTransform: "uppercase" }}>{monthName(t.month)} {t.year}</div>
                    </div>
                  ))}
                </div>}
            </div>
            <p className="form-label" style={{ marginBottom: "0.75rem" }}>{t("Dodaj wejścia","Add credits")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">{t("Liczba","Amount")}</label><input className="form-input" type="number" min="1" max="30" value={tokenForm.amount} onChange={e => setTokenForm({ ...tokenForm, amount: +e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">{t("Miesiąc","Month")}</label><select className="form-input" value={tokenForm.month} onChange={e => setTokenForm({ ...tokenForm, month: +e.target.value })}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{monthName(m)}</option>)}</select></div>
              <div className="form-group" style={{ margin: 0 }}><label className="form-label">{t("Rok","Year")}</label><input className="form-input" type="number" min="2024" max="2030" value={tokenForm.year} onChange={e => setTokenForm({ ...tokenForm, year: +e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">{t("Notatka","Note")}</label><input className="form-input" placeholder={t("np. Gotówka, karnet 10 wejść","e.g. Cash, 10-entry pass")} value={tokenForm.note} onChange={e => setTokenForm({ ...tokenForm, note: e.target.value })} /></div>
            <button className="btn btn-primary btn-full" onClick={handleAddTokens}>+ {t("Dodaj","Add")} {tokenForm.amount} {lang === "en" ? (tokenForm.amount === 1 ? "credit" : "credits") : (tokenForm.amount === 1 ? "wejście" : tokenForm.amount < 5 ? "wejścia" : "wejść")} {t("na","for")} {monthName(tokenForm.month)}</button>
            {userTokenHistory.length > 0 && (
              <>
                <p className="form-label" style={{ margin: "1.5rem 0 0.75rem" }}>{t("Historia","History")}</p>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  {userTokenHistory.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", fontSize: "0.8rem" }}>
                      <span style={{ color: h.amount > 0 ? "var(--sage-dark)" : "var(--clay)" }}>{h.amount > 0 ? "+" : ""}{h.amount} · {h.note || h.classes?.name || "—"}</span>
                      <span style={{ color: "var(--light)" }}>{monthName(h.month)} {h.year}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL - Szablon zajęć */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTemplateModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>📋 {t("Zapisz szablon zajęć","Save class template")}</h3><button className="modal-close" onClick={() => setShowTemplateModal(false)}>×</button></div>
            <p style={{ fontSize: "0.875rem", color: "var(--mid)", marginBottom: "1.25rem" }}>{t("Szablon pozwoli szybko wypełnić formularz przy tworzeniu nowych zajęć.","The template will let you quickly fill in the form when creating new classes.")}</p>
            <div className="form-group"><label className="form-label">{t("Nazwa szablonu","Template name")}</label><input className="form-input" placeholder={t("np. Pilates Flow","e.g. Pilates Flow")} value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">{t("Czas (min)","Duration (min)")}</label><input className="form-input" type="number" value={templateForm.duration_min} onChange={e => setTemplateForm({ ...templateForm, duration_min: +e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t("Maks. miejsc","Max spots")}</label><input className="form-input" type="number" value={templateForm.max_spots} onChange={e => setTemplateForm({ ...templateForm, max_spots: +e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group"><label className="form-label">{t("Cena (zł)","Price (PLN)")}</label><input className="form-input" type="number" placeholder={t("np. 60","e.g. 60")} value={templateForm.price_pln} onChange={e => setTemplateForm({ ...templateForm, price_pln: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t("Koszt sali (zł)","Venue cost (PLN)")}</label><input className="form-input" type="number" placeholder={t("np. 100","e.g. 100")} value={templateForm.venue_cost_pln} onChange={e => setTemplateForm({ ...templateForm, venue_cost_pln: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">{t("Lokalizacja","Location")}</label><input className="form-input" placeholder={t("np. Sala A","e.g. Room A")} value={templateForm.location} onChange={e => setTemplateForm({ ...templateForm, location: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">{t("Notatki","Notes")}</label><input className="form-input" placeholder={t("np. Przynieś matę","e.g. Bring a mat")} value={templateForm.notes} onChange={e => setTemplateForm({ ...templateForm, notes: e.target.value })} /></div>

            {templates.length > 0 && (
              <>
                <p className="form-label" style={{ margin: "1rem 0 0.5rem" }}>{t("Istniejące szablony","Existing templates")}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 150, overflowY: "auto" }}>
                  {templates.map(tmpl => (
                    <div key={tmpl.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "var(--cream)", borderRadius: 6 }}>
                      <span style={{ fontSize: "0.875rem" }}>{tmpl.name} · {tmpl.duration_min} min · {tmpl.price_pln ? tmpl.price_pln + " zł" : "—"}</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTemplate(tmpl.id)}>{t("Usuń","Delete")}</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>{t("Anuluj","Cancel")}</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateForm.name}>{t("Zapisz szablon","Save template")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Dodaj uczestnika */}
      {showAddUserModal && selectedClass && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddUserModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{t("Dodaj uczestnika","Add participant")}</h3><button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button></div>
            <p style={{ color: "var(--mid)", fontSize: "0.875rem", marginBottom: "1rem" }}>{t("Zapisz klientkę na:","Book client into:")} <strong>{selectedClass.name}</strong></p>
            {notEnrolled.length === 0 ? <p style={{ color: "var(--mid)" }}>{t("Wszystkie są zapisane.","All clients are booked.")}</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 300, overflowY: "auto" }}>
                {notEnrolled.map(u => (
                  <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <div><div style={{ fontWeight: 500 }}>{u.first_name} {u.last_name}</div><div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>{u.email}</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAddUserToClass(u.id, selectedClass.id)}>{t("Zapisz","Book")}</button>
                  </div>
                ))}
              </div>}
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>{t("Zamknij","Close")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenBadge({ userId, month, year }) {
  const [tokens, setTokens] = useState(null);
  useEffect(() => {
    supabase.from("tokens").select("amount")
      .eq("user_id", userId).eq("month", month).eq("year", year)
      .maybeSingle()
      .then(({ data }) => setTokens(data?.amount ?? 0));
  }, [userId, month, year]);
  if (tokens === null) return <span style={{ color: "var(--light)" }}>—</span>;
  return <span style={{ fontWeight: 500, color: tokens > 0 ? "var(--sage-dark)" : "var(--light)" }}>🎫 {tokens}</span>;
}
