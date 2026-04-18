import { supabase } from "./supabase";

let _studioInfo = null;

export function setEmailStudio(studio) {
  if (!studio) return;
  _studioInfo = {
    from_email: studio.branding?.email_from || "noreply@paulapilates.pl",
    from_name: studio.name || "Studio",
    app_url: studio.branding?.app_url || "https://paulapilates.pl",
  };
}

export async function sendEmail(type, to, data) {
  if (window.__isDemo) return;
  try {
    const { data: result, error } = await supabase.functions.invoke("send-email", {
      body: { type, to, data, studio: _studioInfo },
    });
    if (error) console.error("Email error:", error);
    return result;
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

export function formatEmailDate(iso) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

export function formatEmailTime(iso) {
  return new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit"
  });
}

export function monthNamePL(m) {
  return ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
    "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"][m - 1];
}
