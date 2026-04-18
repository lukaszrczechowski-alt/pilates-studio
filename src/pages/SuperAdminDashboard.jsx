import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const EMPTY_STUDIO = {
  name: "",
  slug: "",
  domain: "",
  features: { is_demo: false, multi_staff: false, tokens_enabled: true },
  branding: { nav_name: "", email_from: "", app_url: "", logo_url: "", sms_signature: "" },
};

async function callApi(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/superadmin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Błąd API");
  return json;
}

export default function SuperAdminDashboard({ session, onLogout }) {
  const [studios, setStudios] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', studio }
  const [form, setForm] = useState(EMPTY_STUDIO);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: s }, { data: st }] = await Promise.all([
        callApi("list_studios"),
        callApi("get_stats"),
      ]);
      setStudios(s || []);
      setStats(st || {});
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function openCreate() {
    setForm(JSON.parse(JSON.stringify(EMPTY_STUDIO)));
    setLogoFile(null);
    setModal({ mode: "create" });
  }

  function openEdit(studio) {
    setForm({
      ...studio,
      features: {
        is_demo: studio.features?.is_demo === true,
        multi_staff: studio.features?.multi_staff === true,
        tokens_enabled: studio.features?.tokens_enabled !== false,
      },
      branding: {
        nav_name: studio.branding?.nav_name || "",
        email_from: studio.branding?.email_from || "",
        app_url: studio.branding?.app_url || "",
        logo_url: studio.branding?.logo_url || "",
        sms_signature: studio.branding?.sms_signature || "",
      },
    });
    setLogoFile(null);
    setModal({ mode: "edit", studio });
  }

  function closeModal() {
    setModal(null);
    setLogoFile(null);
  }

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

  async function uploadLogo(studioSlug) {
    if (!logoFile) return form.branding.logo_url || null;
    const ext = logoFile.name.split(".").pop();
    const path = `${studioSlug}/logo.${ext}`;
    const { error } = await supabase.storage
      .from("logos")
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
    if (error) throw new Error("Błąd uploadu logo: " + error.message);
    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
    return publicUrl;
  }

  async function handleSave() {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo(form.slug);
      const payload = {
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
        domain: form.domain || null,
        features: form.features,
        branding: { ...form.branding, logo_url: logoUrl || form.branding.logo_url },
      };

      if (modal.mode === "create") {
        await callApi("create_studio", payload);
      } else {
        await callApi("update_studio", { id: modal.studio.id, ...payload });
      }
      closeModal();
      loadAll();
    } catch (e) {
      alert("Błąd: " + e.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    try {
      await callApi("delete_studio", { id });
      setConfirmDelete(null);
      loadAll();
    } catch (e) {
      alert("Błąd: " + e.message);
    }
  }

  const totalProfiles = Object.values(stats).reduce((s, v) => s + (v.profiles || 0), 0);
  const totalClasses = Object.values(stats).reduce((s, v) => s + (v.classes || 0), 0);
  const totalBookings = Object.values(stats).reduce((s, v) => s + (v.bookings || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", padding: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2rem", margin: 0 }}>
            Studiova — Super Admin
          </h1>
          <p style={{ color: "var(--mid)", margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
            {session?.user?.email}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onLogout}>Wyloguj</button>
      </div>

      {/* Stats summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Studiów", value: studios.length },
          { label: "Klientów", value: totalProfiles },
          { label: "Rezerwacji", value: totalBookings },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <div style={{ fontSize: "2rem", fontFamily: "Cormorant Garamond, serif", color: "var(--sage)" }}>{s.value}</div>
            <div style={{ color: "var(--mid)", fontSize: "0.85rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Studios list */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Studia</h2>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nowe studio</button>
      </div>

      {loading && <p style={{ color: "var(--mid)" }}>Ładowanie...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && studios.map(studio => {
        const s = stats[studio.id] || {};
        const isDemo = studio.features?.is_demo;
        return (
          <div key={studio.id} className="card" style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {studio.branding?.logo_url
                ? <img src={studio.branding.logo_url} alt="" style={{ height: "40px", width: "40px", objectFit: "contain", borderRadius: "4px" }} />
                : <div style={{ width: "40px", height: "40px", borderRadius: "4px", background: "var(--sage-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sage-dark)", fontWeight: "bold" }}>
                    {studio.name?.[0]}
                  </div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <strong>{studio.name}</strong>
                  {isDemo && <span style={{ fontSize: "0.7rem", background: "var(--clay-light)", color: "var(--clay)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>DEMO</span>}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--mid)" }}>
                  {studio.domain || `${studio.slug}.studiova.app`}
                  {" · "}slug: <code>{studio.slug}</code>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "var(--mid)", textAlign: "center" }}>
                <div><div style={{ fontWeight: "600", color: "var(--charcoal)" }}>{s.profiles || 0}</div>klientów</div>
                <div><div style={{ fontWeight: "600", color: "var(--charcoal)" }}>{s.classes || 0}</div>zajęć</div>
                <div><div style={{ fontWeight: "600", color: "var(--charcoal)" }}>{s.bookings || 0}</div>rezerwacji</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(studio)}>Edytuj</button>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(studio)}>Usuń</button>
              </div>
            </div>
            {/* Features badges */}
            <div style={{ marginTop: "0.5rem", paddingLeft: "3.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {studio.features?.multi_staff && <span style={badgeStyle}>multi_staff</span>}
              {studio.features?.tokens_enabled === false && <span style={badgeStyle}>bez karnetów</span>}
            </div>
          </div>
        );
      })}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === "create" ? "Nowe studio" : `Edytuj: ${modal.studio.name}`}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Basic */}
              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Podstawowe</legend>
                <div className="form-group">
                  <label className="form-label">Nazwa *</label>
                  <input className="form-input" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="np. Studio Roberta" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">Slug * <span style={{ color: "var(--mid)", fontSize: "0.75rem" }}>(subdomena)</span></label>
                    <input className="form-input" value={form.slug} onChange={e => setField("slug", e.target.value)} placeholder="np. robert" disabled={modal.mode === "edit"} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custom domain <span style={{ color: "var(--mid)", fontSize: "0.75rem" }}>(opcjonalnie)</span></label>
                    <input className="form-input" value={form.domain} onChange={e => setField("domain", e.target.value)} placeholder="np. robertfryzjer.pl" />
                  </div>
                </div>
              </fieldset>

              {/* Features */}
              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Funkcje (feature flags)</legend>
                {[
                  { key: "is_demo", label: "Demo studio (blokuje SMS/email/push)" },
                  { key: "multi_staff", label: "Wielu pracowników (zakładka Pracownicy)" },
                  { key: "tokens_enabled", label: "Karnety wejść (odznacz dla fryzjerów, warsztatów)" },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", marginBottom: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={form.features[key] === true || (key === "tokens_enabled" && form.features[key] !== false)}
                      onChange={e => setField(`features.${key}`, key === "tokens_enabled" ? e.target.checked : e.target.checked)}
                    />
                    <span style={{ fontSize: "0.9rem" }}>{label}</span>
                  </label>
                ))}
              </fieldset>

              {/* Branding */}
              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Branding</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">Nazwa w nav</label>
                    <input className="form-input" value={form.branding.nav_name} onChange={e => setField("branding.nav_name", e.target.value)} placeholder="np. Studio Roberta" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Podpis SMS</label>
                    <input className="form-input" value={form.branding.sms_signature} onChange={e => setField("branding.sms_signature", e.target.value)} placeholder="np. Robert Fryzjer" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email nadawcy</label>
                    <input className="form-input" type="email" value={form.branding.email_from} onChange={e => setField("branding.email_from", e.target.value)} placeholder="noreply@robertfryzjer.pl" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL aplikacji</label>
                    <input className="form-input" value={form.branding.app_url} onChange={e => setField("branding.app_url", e.target.value)} placeholder="https://robertfryzjer.pl" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Logo</label>
                  {form.branding.logo_url && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <img src={form.branding.logo_url} alt="logo" style={{ height: "48px", objectFit: "contain" }} />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} style={{ fontSize: "0.85rem" }} />
                  {logoFile && <div style={{ fontSize: "0.8rem", color: "var(--mid)", marginTop: "0.25rem" }}>Plik: {logoFile.name}</div>}
                </div>
              </fieldset>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={closeModal}>Anuluj</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.slug}>
                  {saving ? "Zapisywanie..." : modal.mode === "create" ? "Utwórz studio" : "Zapisz zmiany"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: "400px" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Usuń studio</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <p>Czy na pewno chcesz usunąć studio <strong>{confirmDelete.name}</strong>?</p>
              <p style={{ color: "var(--clay)", fontSize: "0.85rem" }}>Ta operacja jest nieodwracalna i usunie wszystkie powiązane dane.</p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Anuluj</button>
                <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete.id)}>Usuń</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const badgeStyle = {
  fontSize: "0.7rem",
  padding: "0.1rem 0.5rem",
  borderRadius: "4px",
  background: "var(--sage-light)",
  color: "var(--sage-dark)",
};

const fieldsetStyle = {
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1rem",
  margin: 0,
};

const legendStyle = {
  fontSize: "0.8rem",
  fontWeight: "600",
  color: "var(--mid)",
  padding: "0 0.4rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
