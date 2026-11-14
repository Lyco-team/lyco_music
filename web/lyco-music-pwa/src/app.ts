import { LOCALES, translate, translateFormat, type Locale } from "../../../packages/core/src/i18n";
import { toTraditional } from "../../../packages/core/src/text/s2t";
import { ZH, EN, KO } from "./copy";

const STORAGE_KEY = "lxmn.pwa.locale";
const VERSION = "0.2.62";
const KEY_COUNT = 224;

function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && LOCALES.some((l) => l.id === value);
}

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* storage disabled */ }
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.startsWith("zh-hant")) return "zh-TW";
  if (nav.startsWith("ko")) return "ko-KR";
  if (nav.startsWith("en")) return "en-US";
  return "zh-CN";
}

let current: Locale = detectLocale();
let twCache: Record<string, string> | null = null;

function localDict(loc: Locale): Record<string, string> {
  if (loc === "en-US") return EN;
  if (loc === "ko-KR") return KO;
  if (loc === "zh-TW") {
    if (!twCache) {
      const out: Record<string, string> = {};
      for (const key of Object.keys(ZH)) out[key] = toTraditional(ZH[key]!);
      twCache = out;
    }
    return twCache;
  }
  return ZH;
}

// 先查只读页增量文案，再落到 core 的 224 个共享 key。
function t(key: string): string {
  const local = localDict(current)[key];
  if (local) return local;
  return translate(key, current, translate(key, "zh-CN", key));
}

function tf(key: string, params: Record<string, string | number>): string {
  const local = localDict(current)[key];
  if (local) {
    let out = local;
    for (const k of Object.keys(params)) out = out.split("{" + k + "}").join(String(params[k]));
    return out;
  }
  return translateFormat(key, current, params);
}

function render(): void {
  document.documentElement.lang = current;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-version]").forEach((el) => { el.textContent = VERSION; });
  document.querySelectorAll<HTMLElement>("[data-i18n-keys]").forEach((el) => { el.textContent = String(KEY_COUNT); });
  document.querySelectorAll<HTMLElement>("[data-i18n-total]").forEach((el) => {
    el.textContent = tf("mobile.search.total", { n: KEY_COUNT });
  });
  const bar = document.getElementById("pwa-langs");
  if (bar) {
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    bar.setAttribute("aria-label", t("settings.language"));
    for (const item of LOCALES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pwa-lang" + (item.id === current ? " is-active" : "");
      button.textContent = item.native;
      button.setAttribute("aria-pressed", item.id === current ? "true" : "false");
      button.addEventListener("click", () => {
        current = item.id;
        try { localStorage.setItem(STORAGE_KEY, current); } catch { /* storage disabled */ }
        render();
      });
      bar.appendChild(button);
    }
  }
  document.title = t("pwa.docTitle");
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/lyco-music/sw.js", { scope: "/lyco-music/" }).catch(() => undefined);
  });
}
