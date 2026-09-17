import { useRef, useState } from "react";
import {
  ExternalLink,
  FileVideo,
  LoaderCircle,
  Maximize2,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/api";
import type { ReportVideo } from "@/lib/reports";

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function VideoReportCard({
  video,
  canDelete = false,
  onDelete,
}: {
  video: ReportVideo;
  canDelete?: boolean;
  onDelete?: (videoReportId: number) => Promise<void>;
}) {
  const hasSummary = Boolean(
    video.summary?.completed || video.summary?.problems || video.summary?.plans,
  );
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const startPlayback = async () => {
    if (!videoRef.current || isStartingPlayback) return;
    setIsStartingPlayback(true);
    setPlaybackError(false);
    try {
      await videoRef.current.play();
    } catch {
      setPlaybackError(true);
    } finally {
      setIsStartingPlayback(false);
    }
  };

  const openFullscreen = async () => {
    const player = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!player) return;
    try {
      // В desktop-браузерах разворачиваем весь контейнер плеера. Это не
      // конфликтует с нативной fullscreen-кнопкой внутри video controls.
      if (playerContainerRef.current?.requestFullscreen) {
        await playerContainerRef.current.requestFullscreen();
        return;
      }
      if (player.requestFullscreen) {
        await player.requestFullscreen();
        return;
      }
      // Safari iOS поддерживает fullscreen только у самого video-элемента.
      player.webkitEnterFullscreen?.();
    } catch {
      // On browsers that deny fullscreen the regular player controls remain available.
    }
  };

  const deleteVideo = async () => {
    if (!video.id || !onDelete || isDeleting) return;
    if (
      !window.confirm(
        "Удалить видеоотчет? Ролик и его подготовленные копии будут удалены из хранилища. После этого можно загрузить новый.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      await onDelete(video.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось удалить видеоотчет";
      setDeleteError(message);
      toast.error(message);
      setIsDeleting(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
            <FileVideo className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold">Видеоотчет</h2>
            <p className="text-sm text-muted-foreground">{formatDate(video.date).slice(0, 10)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && video.id && onDelete ? (
            <Button variant="outline" size="sm" disabled={isDeleting} onClick={deleteVideo}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {isDeleting ? "Удаляем…" : "Удалить"}
            </Button>
          ) : null}
          {video.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={video.url} target="_blank" rel="noreferrer">
                Открыть видео
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
          {video.url ? (
            <Button variant="outline" size="sm" onClick={() => void openFullscreen()}>
              <Maximize2 className="mr-2 h-3.5 w-3.5" />
              На весь экран
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(16rem,1fr)] lg:items-center">
        <div>
          <div ref={playerContainerRef} className="relative overflow-hidden rounded-xl bg-black">
            {video.url ? (
              <>
                <video
                  ref={videoRef}
                  className="aspect-video w-full object-contain"
                  controls={hasStartedPlayback}
                  controlsList="nodownload noremoteplayback noplaybackrate"
                  disablePictureInPicture
                  playsInline
                  // MinIO currently ignores HTTP Range. Do not automatically
                  // download a potentially 200 MB report on page open.
                  preload="none"
                  src={video.url}
                  onLoadedMetadata={(event) => {
                    setDetectedDuration(formatDuration(event.currentTarget.duration));
                  }}
                  onPlay={() => {
                    setHasStartedPlayback(true);
                    setPlaybackError(false);
                  }}
                  onWaiting={() => {
                    if (hasStartedPlayback) setIsBuffering(true);
                  }}
                  onPlaying={() => setIsBuffering(false)}
                  onCanPlay={() => setIsBuffering(false)}
                  onError={() => {
                    setIsBuffering(false);
                    setPlaybackError(true);
                  }}
                >
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
                {!hasStartedPlayback ? (
                  <button
                    type="button"
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 text-white transition hover:bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    onClick={startPlayback}
                    aria-label="Запустить видео"
                  >
                    <span className="flex items-center gap-2 rounded-full bg-black/70 px-5 py-3 text-sm font-medium shadow-lg">
                      {isStartingPlayback ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                      {isStartingPlayback ? "Запускаем…" : "Запустить видео"}
                    </span>
                  </button>
                ) : null}
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                Видеофайл недоступен
              </div>
            )}
          </div>
          {hasStartedPlayback && isBuffering ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Подгружаем видео…
            </p>
          ) : null}
          {playbackError ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Не удалось воспроизвести ролик в браузере. Откройте его отдельной кнопкой.
            </p>
          ) : null}
        </div>

        <section className="min-w-0 rounded-xl bg-muted/50 p-4">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Текст видеоотчета
          </div>
          {hasSummary ? (
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              {video.summary?.completed ? <p>{video.summary.completed}</p> : null}
              {video.summary?.problems ? <p>Проблемы: {video.summary.problems}</p> : null}
              {video.summary?.plans ? <p>Планы: {video.summary.plans}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Обработка видео через модель временно недоступна. Ролик уже сохранён и доступен для
              просмотра.
            </p>
          )}
          <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>Загружен</dt>
              <dd>{video.createdAt ? formatDate(video.createdAt) : "не указано"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Длительность</dt>
              <dd>{detectedDuration || video.duration || "определяется после запуска"}</dd>
            </div>
          </dl>
        </section>
      </div>
      {deleteError ? <p className="mt-3 text-sm text-destructive">{deleteError}</p> : null}
    </article>
  );
}
