import { supabase } from "./supabase";

export async function sendEmail(type, to, data) {
  if (window.__isDemo) return;
  try {
    const { data: result, error } = await supabase.functions.invoke("send-email", {
      body: { type, to, data },
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
