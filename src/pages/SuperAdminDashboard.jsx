import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Wszystkie ficzery — tutaj zarządzasz listą
const ALL_FEATURES = [
  { key: "tokens_enabled",  label: "Karnety / wejściówki",          group: "Podstawowe" },
  { key: "guest_booking",   label: "Rezerwacja bez konta",           group: "Podstawowe" },
  { key: "waitlist_enabled",label: "Lista oczekujących",             group: "Podstawowe" },
  { key: "ratings_enabled", label: "Oceny zajęć (1–5 ★)",           group: "Podstawowe" },
  { key: "multilingual",    label: "Wielojęzyczność (PL/EN)",        group: "Komunikacja" },
  { key: "sms_enabled",     label: "SMS — przypomnienia, życzenia",  group: "Komunikacja" },
  { key: "push_enabled",    label: "Push notifications",             group: "Komunikacja" },
  { key: "payments_online", label: "Płatności online (P24 / Stripe)",group: "Płatności" },
  { key: "multi_staff",     label: "Wielu instruktorów",             group: "Zaawansowane" },
  { key: "custom_domain",   label: "Własna domena",                  group: "Zaawansowane" },
  { key: "reports_enabled", label: "Raporty finansowe",              group: "Zaawansowane" },
  { key: "landing_custom",  label: "Customowa strona główna",        group: "Branding" },
  { key: "is_demo",         label: "Tryb demo (blokuje SMS/push)",   group: "System" },
];

const GROUPS = [...new Set(ALL_FEATURES.map(f => f.group))];

const EMPTY_STUDIO = {
  name: "", slug: "", domain: "",
  features: { is_demo: false, multi_staff: false, tokens_enabled: true },
  branding: { nav_name: "", email_from: "", app_url: "", logo_url: "", sms_signature: "" },
};

async function callApi(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/superadmin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Błąd API");
  return json;
}

export default function SuperAdminDashboard({ session, onLogout }) {
  const [tab, setTab] = useState("studios");
  const [studios, setStudios] = useState([]);
  const [stats, setStats]     = useState({});
  const [plans, setPlans]     = useState([]);
  const [plansError, setPlansError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Studio modal
  const [studioModal, setStudioModal] = useState(null);
  const [form, setForm]               = useState(EMPTY_STUDIO);
  const [logoFile, setLogoFile]       = useState(null);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Plans local edits: { [planId]: { name, price_pln, features: {} } }
  const [planEdits, setPlanEdits]     = useState({});
  const [planSaving, setPlanSaving]   = useState({});
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: s }, { data: st }] = await Promise.all([
        callApi("list_studios"),
        callApi("get_stats"),
      ]);
      setStudios(s || []);
      setStats(st || {});
    } catch (e) {
      console.error(e);
    }
    // Plans osobno — mogą nie istnieć jeszcze
    try {
      const { data: p } = await callApi("list_plans");
      setPlans(p || []);
      initPlanEdits(p || []);
      setPlansError(null);
    } catch (e) {
      setPlansError(e.message);
    }
    setLoading(false);
  }

  function initPlanEdits(ps) {
    const edits = {};
    ps.forEach(p => {
      edits[p.id] = { name: p.name, price_pln: p.price_pln ?? 0, features: { ...(p.features || {}) } };
    });
    setPlanEdits(edits);
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  function setPlanField(planId, field, value) {
    setPlanEdits(prev => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }));
  }

  function toggleFeature(planId, key) {
    setPlanEdits(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        features: { ...(prev[planId]?.features || {}), [key]: !prev[planId]?.features?.[key] },
      },
    }));
  }

  async function savePlan(planId) {
    const isNew = planId.startsWith("__new");
    setPlanSaving(prev => ({ ...prev, [planId]: true }));
    try {
      const edit = planEdits[planId];
      const { data: saved } = await callApi("save_plan", {
        id: isNew ? undefined : planId,
        name: edit.name || "Nowy pakiet",
        price_pln: Number(edit.price_pln) || 0,
        features: edit.features || {},
        sort_order: plans.findIndex(p => p.id === planId),
      });
      await loadAll();
    } catch (e) {
      alert("Błąd zapisu: " + e.message);
    }
    setPlanSaving(prev => ({ ...prev, [planId]: false }));
  }

  async function deletePlan(planId) {
    try {
      await callApi("delete_plan", { id: planId });
      setConfirmDeletePlan(null);
      loadAll();
    } catch (e) {
      alert("Błąd: " + e.message);
    }
  }

  function addNewPlan() {
    const tmpId = `__new_${Date.now()}`;
    const newPlan = { id: tmpId, name: "Nowy pakiet", price_pln: 0, features: {} };
    setPlans(prev => [...prev, newPlan]);
    setPlanEdits(prev => ({ ...prev, [tmpId]: { name: "Nowy pakiet", price_pln: 0, features: {} } }));
  }

  // ── Studios ───────────────────────────────────────────────────────────────

  function setField(path, value) {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function handleSaveStudio() {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      let logoUrl = form.branding.logo_url;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${form.slug}/logo.${ext}`;
        const { error: upErr } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw new Error("Błąd logo: " + upErr.message);
        const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
        logoUrl = publicUrl;
      }
      const payload = {
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
        domain: form.domain || null,
        plan_id: form.plan_id || null,
        features: form.features,
        branding: { ...form.branding, logo_url: logoUrl },
      };
      if (studioModal.mode === "create") await callApi("create_studio", payload);
      else await callApi("update_studio", { id: studioModal.studio.id, ...payload });
      setStudioModal(null);
      loadAll();
    } catch (e) {
      alert("Błąd: " + e.message);
    }
    setSaving(false);
  }

  async function handleDeleteStudio(id) {
    try {
      await callApi("delete_studio", { id });
      setConfirmDelete(null);
      loadAll();
    } catch (e) {
      alert("Błąd: " + e.message);
    }
  }

  const totalProfiles = Object.values(stats).reduce((s, v) => s + (v.profiles || 0), 0);
  const totalBookings = Object.values(stats).reduce((s, v) => s + (v.bookings || 0), 0);

  // ── Plan lookup
  const planMap = Object.fromEntries(plans.filter(p => !p.id.startsWith("__new")).map(p => [p.id, p]));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F7F3EE" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E0D8", padding: "0 2rem", height: 64, display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", fontWeight: 400, color: "#2C2C2C", letterSpacing: "0.02em" }}>
          Studiova <span style={{ color: "#8A9E85" }}>Admin</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "0.8rem", color: "#ADADAD" }}>{session?.user?.email}</span>
        <button className="btn btn-secondary btn-sm" onClick={onLogout}>Wyloguj</button>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E0D8", padding: "0 2rem", display: "flex", gap: "0" }}>
        {[
          { id: "studios", label: `Studia (${studios.length})` },
          { id: "plans",   label: "Pakiety" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            border: "none", background: "none", padding: "0.875rem 1.25rem",
            fontSize: "0.875rem", fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? "#8A9E85" : "#6B6B6B",
            borderBottom: tab === t.id ? "2px solid #8A9E85" : "2px solid transparent",
            cursor: "pointer", transition: "color 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Aktywne studia", value: studios.length },
            { label: "Łącznie klientów", value: totalProfiles },
            { label: "Łącznie rezerwacji", value: totalBookings },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #E8E0D8", borderRadius: 12, padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2rem", color: "#8A9E85", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.8rem", color: "#6B6B6B" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading && <p style={{ color: "#ADADAD", textAlign: "center" }}>Ładowanie...</p>}

        {/* ── TAB: STUDIA ───────────────────────────────────────────────── */}
        {tab === "studios" && !loading && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Studia</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setForm(JSON.parse(JSON.stringify(EMPTY_STUDIO))); setLogoFile(null); setStudioModal({ mode: "create" }); }}>
                + Nowe studio
              </button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #E8E0D8", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E8E0D8" }}>
                    {["Studio", "Domena", "Pakiet", "Klienci", "Zajęcia", ""].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, fontSize: "0.75rem", color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studios.map((s, i) => {
                    const st = stats[s.id] || {};
                    const plan = planMap[s.plan_id];
                    return (
                      <tr key={s.id} style={{ borderBottom: i < studios.length - 1 ? "1px solid #F0EBE4" : "none" }}>
                        <td style={{ padding: "0.875rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#B8CBAF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cormorant Garamond, serif", fontSize: "1rem", color: "#5C7A56", flexShrink: 0 }}>
                              {s.branding?.logo_url
                                ? <img src={s.branding.logo_url} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: "50%" }} />
                                : s.name?.[0]
                              }
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{s.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "#ADADAD" }}>{s.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "0.875rem 1rem", color: "#6B6B6B" }}>
                          {s.domain || `${s.slug}.studiova.app`}
                          {s.features?.is_demo && <span style={tagStyle("#FFF3E0", "#E65100")}> DEMO</span>}
                        </td>
                        <td style={{ padding: "0.875rem 1rem" }}>
                          {plan
                            ? <span style={tagStyle("#EDF4EB", "#5C7A56")}>{plan.name}</span>
                            : <span style={{ color: "#ADADAD", fontSize: "0.8rem" }}>— brak —</span>
                          }
                        </td>
                        <td style={{ padding: "0.875rem 1rem", color: "#6B6B6B" }}>{st.profiles || 0}</td>
                        <td style={{ padding: "0.875rem 1rem", color: "#6B6B6B" }}>{st.classes || 0}</td>
                        <td style={{ padding: "0.875rem 1rem" }}>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setForm({ ...s, features: s.features || {}, branding: s.branding || {}, plan_id: s.plan_id || "" });
                              setLogoFile(null);
                              setStudioModal({ mode: "edit", studio: s });
                            }}>Edytuj</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(s)}>Usuń</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── TAB: PAKIETY ─────────────────────────────────────────────── */}
        {tab === "plans" && !loading && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Pakiety</h2>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#6B6B6B" }}>
                  Zmiany ficzerów w pakiecie działają dla wszystkich studiów na tym pakiecie.
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addNewPlan}>+ Nowy pakiet</button>
            </div>

            {plansError && (
              <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                <strong>Brak tabeli plans w Supabase.</strong> Uruchom poniższy SQL w SQL Editor:
                <pre style={{ marginTop: "0.5rem", background: "#fff", padding: "0.75rem", borderRadius: 6, fontSize: "0.78rem", overflowX: "auto" }}>{`CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Nowy pakiet',
  price_pln INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE studios ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id);`}</pre>
              </div>
            )}

            {!plansError && plans.length === 0 && (
              <div style={{ textAlign: "center", color: "#ADADAD", padding: "3rem", background: "#fff", borderRadius: 12, border: "1px dashed #E8E0D8" }}>
                Brak pakietów. Kliknij <strong>+ Nowy pakiet</strong> żeby dodać pierwszy.
              </div>
            )}

            {!plansError && plans.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #E8E0D8", borderRadius: 12, overflow: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: "0.875rem", minWidth: "100%" }}>
                  <thead>
                    {/* Plan names */}
                    <tr style={{ borderBottom: "1px solid #E8E0D8" }}>
                      <th style={{ ...matrixTh, width: 220, background: "#FDFAF6" }}>Ficzer</th>
                      {plans.map(p => (
                        <th key={p.id} style={{ ...matrixTh, minWidth: 160 }}>
                          <input
                            value={planEdits[p.id]?.name ?? p.name}
                            onChange={e => setPlanField(p.id, "name", e.target.value)}
                            style={{ border: "none", fontWeight: 600, fontSize: "0.95rem", width: "100%", textAlign: "center", background: "transparent", outline: "none", color: "#2C2C2C", fontFamily: "inherit" }}
                            placeholder="Nazwa pakietu"
                          />
                        </th>
                      ))}
                    </tr>
                    {/* Prices + actions */}
                    <tr style={{ borderBottom: "2px solid #E8E0D8", background: "#FDFAF6" }}>
                      <td style={{ ...matrixTd, color: "#6B6B6B", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cena / mc</td>
                      {plans.map(p => (
                        <td key={p.id} style={{ ...matrixTd, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", marginBottom: "0.5rem" }}>
                            <input
                              type="number"
                              min={0}
                              value={planEdits[p.id]?.price_pln ?? p.price_pln ?? 0}
                              onChange={e => setPlanField(p.id, "price_pln", e.target.value)}
                              style={{ width: 60, border: "1px solid #E8E0D8", borderRadius: 4, padding: "0.2rem 0.4rem", textAlign: "right", fontSize: "0.85rem" }}
                            />
                            <span style={{ fontSize: "0.75rem", color: "#ADADAD" }}>zł</span>
                          </div>
                          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => savePlan(p.id)}
                              disabled={!!planSaving[p.id]}
                              style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                            >
                              {planSaving[p.id] ? "…" : "Zapisz"}
                            </button>
                            {!p.id.startsWith("__new") && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setConfirmDeletePlan(p)}
                                style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem" }}
                              >Usuń</button>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GROUPS.map(group => (
                      <>
                        {/* Group header */}
                        <tr key={`g_${group}`} style={{ background: "#F7F3EE" }}>
                          <td colSpan={plans.length + 1} style={{ padding: "0.4rem 1rem", fontSize: "0.7rem", fontWeight: 700, color: "#ADADAD", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {group}
                          </td>
                        </tr>
                        {/* Feature rows */}
                        {ALL_FEATURES.filter(f => f.group === group).map((feat, fi) => (
                          <tr key={feat.key} style={{ borderBottom: "1px solid #F0EBE4" }}>
                            <td style={{ ...matrixTd, background: "#FDFAF6", fontWeight: 400, color: "#2C2C2C" }}>
                              {feat.label}
                            </td>
                            {plans.map(p => {
                              const checked = !!(planEdits[p.id]?.features?.[feat.key]);
                              return (
                                <td key={p.id} style={{ ...matrixTd, textAlign: "center" }}>
                                  <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleFeature(p.id, feat.key)}
                                      style={{ width: 16, height: 16, accentColor: "#8A9E85", cursor: "pointer" }}
                                    />
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Studios plan summary */}
            {!plansError && plans.filter(p => !p.id.startsWith("__new")).length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", color: "#6B6B6B" }}>Studia → Pakiety</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {studios.map(s => {
                    const plan = planMap[s.plan_id];
                    return (
                      <div key={s.id} style={{ background: "#fff", border: "1px solid #E8E0D8", borderRadius: 8, padding: "0.5rem 0.875rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                        <span style={{ color: "#ADADAD" }}>→</span>
                        <span style={{ color: plan ? "#5C7A56" : "#ADADAD" }}>{plan?.name || "brak pakietu"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Studio Edit/Create ─────────────────────────────────────── */}
      {studioModal && (
        <div className="modal-overlay" onClick={() => setStudioModal(null)}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{studioModal.mode === "create" ? "Nowe studio" : `Edytuj: ${studioModal.studio?.name}`}</h3>
              <button className="modal-close" onClick={() => setStudioModal(null)}>×</button>
            </div>
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              <fieldset style={fsStyle}>
                <legend style={legStyle}>Podstawowe</legend>
                <div className="form-group">
                  <label className="form-label">Nazwa *</label>
                  <input className="form-input" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Studio Roberta" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">Slug *</label>
                    <input className="form-input" value={form.slug} onChange={e => setField("slug", e.target.value)} placeholder="robert" disabled={studioModal.mode === "edit"} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom domain</label>
                    <input className="form-input" value={form.domain || ""} onChange={e => setField("domain", e.target.value)} placeholder="robert.pl" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Pakiet</label>
                  <select className="form-input" value={form.plan_id || ""} onChange={e => setField("plan_id", e.target.value)}>
                    <option value="">— brak —</option>
                    {plans.filter(p => !p.id.startsWith("__new")).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </fieldset>

              <fieldset style={fsStyle}>
                <legend style={legStyle}>Ficzery (override pakietu)</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                  {ALL_FEATURES.filter(f => f.key !== "is_demo").map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="checkbox" checked={!!form.features[key]} onChange={e => setField(`features.${key}`, e.target.checked)} style={{ accentColor: "#8A9E85" }} />
                      {label}
                    </label>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.82rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #F0EBE4", color: "#C44B4B" }}>
                  <input type="checkbox" checked={!!form.features.is_demo} onChange={e => setField("features.is_demo", e.target.checked)} />
                  Tryb demo (blokuje SMS / push / email)
                </label>
              </fieldset>

              <fieldset style={fsStyle}>
                <legend style={legStyle}>Branding</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group"><label className="form-label">Nazwa w nav</label><input className="form-input" value={form.branding.nav_name || ""} onChange={e => setField("branding.nav_name", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Podpis SMS</label><input className="form-input" value={form.branding.sms_signature || ""} onChange={e => setField("branding.sms_signature", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Email nadawcy</label><input className="form-input" type="email" value={form.branding.email_from || ""} onChange={e => setField("branding.email_from", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">URL aplikacji</label><input className="form-input" value={form.branding.app_url || ""} onChange={e => setField("branding.app_url", e.target.value)} /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Logo</label>
                  {form.branding.logo_url && <img src={form.branding.logo_url} alt="" style={{ height: 40, objectFit: "contain", display: "block", marginBottom: "0.4rem" }} />}
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} style={{ fontSize: "0.82rem" }} />
                </div>
              </fieldset>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setStudioModal(null)}>Anuluj</button>
                <button className="btn btn-primary" onClick={handleSaveStudio} disabled={saving || !form.name || !form.slug}>
                  {saving ? "Zapisywanie…" : studioModal.mode === "create" ? "Utwórz studio" : "Zapisz zmiany"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Studio ──────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Usuń studio</h3><button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button></div>
            <div style={{ padding: "1.5rem" }}>
              <p>Usunąć <strong>{confirmDelete.name}</strong>? Operacja jest nieodwracalna.</p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Anuluj</button>
                <button className="btn btn-danger" onClick={() => handleDeleteStudio(confirmDelete.id)}>Usuń</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Plan ────────────────────────────────────────────── */}
      {confirmDeletePlan && (
        <div className="modal-overlay" onClick={() => setConfirmDeletePlan(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Usuń pakiet</h3><button className="modal-close" onClick={() => setConfirmDeletePlan(null)}>×</button></div>
            <div style={{ padding: "1.5rem" }}>
              <p>Usunąć pakiet <strong>{confirmDeletePlan.name}</strong>? Studia nie stracą ficzerów, ale nie będą miały przypisanego pakietu.</p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDeletePlan(null)}>Anuluj</button>
                <button className="btn btn-danger" onClick={() => deletePlan(confirmDeletePlan.id)}>Usuń</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const matrixTh = { padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600, fontSize: "0.875rem", borderRight: "1px solid #F0EBE4" };
const matrixTd = { padding: "0.6rem 1rem", borderRight: "1px solid #F0EBE4" };
const fsStyle  = { border: "1px solid #E8E0D8", borderRadius: 8, padding: "1rem", margin: 0 };
const legStyle = { fontSize: "0.75rem", fontWeight: 700, color: "#ADADAD", padding: "0 0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" };

function tagStyle(bg, color) {
  return { fontSize: "0.7rem", background: bg, color, padding: "0.1rem 0.4rem", borderRadius: 4, fontWeight: 600, marginLeft: 4 };
}
