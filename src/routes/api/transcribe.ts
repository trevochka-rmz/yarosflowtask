import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { success: false, message: "Распознавание речи не настроено" },
            { status: 500 },
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

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", audio, "recording.wav");
        upstream.append("language", "ru");

        const response = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
          },
        );

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(`Transcription failed [${response.status}]: ${detail}`);
          return Response.json(
            { success: false, message: "Не удалось распознать речь" },
            { status: response.status },
          );
        }

        const data = (await response.json()) as { text?: string };
        return Response.json({ success: true, text: data.text ?? "" });
      },
    },
  },
});
