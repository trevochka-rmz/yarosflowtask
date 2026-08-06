export const TOKEN_KEY = "yaros.token";
export const TELEGRAM_BOT_USERNAME = "YarosTaskFlowBot";

export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
  const initData = tg?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("yaros:auth-changed"));
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("yaros:auth-changed"));
}

/** Заголовки авторизации: initData из Mini App → Bearer token → dev-заголовок только в dev. */
export function authHeaders(): Record<string, string> {
  const initData = getTelegramInitData();
  if (initData) return { "X-Telegram-Init-Data": initData };
  const token = getToken();
  if (token) return { Authorization: `Bearer ${token}` };
  if (import.meta.env.DEV) return { "X-Dev-User-Id": "1" };
  return {};
}

/** Можно ли вообще обращаться к защищённым ручкам. */
export function hasAuth(): boolean {
  return Boolean(getTelegramInitData() || getToken() || import.meta.env.DEV);
}

export interface TelegramWidgetUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}
