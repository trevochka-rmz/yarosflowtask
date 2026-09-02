import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_BASE_URL = "https://admin-dialog.tmg.kg/api/v1";
let cachedToken: string | null = null;
let loginPromise: Promise<string> | null = null;

type SttConfig = {
  baseUrl: string;
  email: string;
  password: string;
  timeoutSeconds: number;
};

function getConfig(): SttConfig | null {
  const email = process.env["STT_API_EMAIL"];
  const password = process.env["STT_API_PASSWORD"];
  if (!email || !password) return null;

  const requestedTimeout = Number(process.env["STT_API_TIMEOUT_SECONDS"] ?? 600);
  const timeoutSeconds = Number.isFinite(requestedTimeout)
    ? Math.min(1800, Math.max(30, Math.trunc(requestedTimeout)))
    : 600;

  return {
    baseUrl: (process.env["STT_API_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    email,
    password,
    timeoutSeconds,
  };
}

async function login(config: SttConfig, force = false): Promise<string> {
  if (!force && cachedToken) return cachedToken;
  if (loginPromise) return loginPromise;
  if (force) cachedToken = null;

  loginPromise = (async () => {
    const response = await fetch(`${config.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password }),
    });
    if (!response.ok) throw new Error(`STT login failed [${response.status}]`);

    const data = (await response.json().catch(() => null)) as
      | { access_token?: string }
      | null;
    if (!data?.access_token) throw new Error("STT login returned no access token");
    cachedToken = data.access_token;
    return cachedToken;
  })().finally(() => {
    loginPromise = null;
  });

  return loginPromise;
}

function sendTranscription(config: SttConfig, token: string, audio: File) {
  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "recording.wav");
  return fetch(
    `${config.baseUrl}/audio/transcribe?wait=true&timeout_seconds=${config.timeoutSeconds}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstream,
    },
  );
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getConfig();
        if (!config) {
          return Response.json(
            { success: false, message: "Распознавание речи не настроено" },
            { status: 503 },
          );
        }

        const form = await request.formData();
        const audio = form.get("file");
        if (!(audio instanceof File) || audio.size < 2048) {
          return Response.json(
            { success: false, message: "Запись пустая, попробуйте ещё раз" },
            { status: 400 },
          );
        }
        if (audio.size > 20 * 1024 * 1024) {
          return Response.json(
            { success: false, message: "Запись слишком длинная" },
            { status: 400 },
          );
        }

        try {
          let token = await login(config);
          let response = await sendTranscription(config, token, audio);
          if (response.status === 401) {
            token = await login(config, true);
            response = await sendTranscription(config, token, audio);
          }

          if (!response.ok) {
            const detail = await response.text().catch(() => "");
            console.error(`STT transcription failed [${response.status}]: ${detail}`);
            return Response.json(
              {
                success: false,
                message:
                  response.status === 504
                    ? "Распознавание заняло слишком много времени"
                    : "Не удалось распознать речь",
              },
              { status: response.status },
            );
          }

          const data = (await response.json().catch(() => null)) as
            | { text?: string }
            | null;
          return Response.json({ success: true, text: data?.text ?? "" });
        } catch (error) {
          console.error("STT request failed:", error);
          return Response.json(
            { success: false, message: "Сервис распознавания речи недоступен" },
            { status: 502 },
          );
        }
      },
    },
  },
});
