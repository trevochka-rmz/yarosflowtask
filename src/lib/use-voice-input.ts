import { useCallback, useRef, useState } from "react";

function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = sampleRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const value = merged[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, value));
    samples[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  new Int16Array(buffer, 44).set(samples);

  return new Blob([buffer], { type: "audio/wav" });
}

type Options = {
  onText: (text: string) => void;
  onError: (message: string) => void;
};

export function useVoiceInput({ onText, onError }: Options) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const ref = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    source: MediaStreamAudioSourceNode;
    node: ScriptProcessorNode;
    chunks: Float32Array[];
  } | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      ref.current = { stream, ctx, source, node, chunks };
      setRecording(true);
    } catch {
      onError("Нет доступа к микрофону");
    }
  }, [onError]);

  const stop = useCallback(async () => {
    const current = ref.current;
    ref.current = null;
    setRecording(false);
    if (!current) return;

    current.stream.getTracks().forEach((t) => t.stop());
    current.node.disconnect();
    current.source.disconnect();
    const blob = encodeWav(current.chunks, current.ctx.sampleRate);
    await current.ctx.close().catch(() => {});

    if (blob.size < 4096) {
      onError("Запись слишком короткая, попробуйте ещё раз");
      return;
    }

    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; text?: string; message?: string }
        | null;
      if (!res.ok || !data?.success) {
        onError(data?.message ?? "Не удалось распознать речь");
        return;
      }
      const text = (data.text ?? "").trim();
      if (!text) {
        onError("Речь не распознана, попробуйте ещё раз");
        return;
      }
      onText(text);
    } catch {
      onError("Не удалось распознать речь");
    } finally {
      setTranscribing(false);
    }
  }, [onError, onText]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (recording) void stop();
    else void start();
  }, [recording, transcribing, start, stop]);

  return { recording, transcribing, toggle };
}
