import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileVideo, LoaderCircle, Maximize2, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/api";
import { reportsService, type ReportVideo } from "@/lib/reports";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/lib/org";

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
  memberId,
  canDelete = false,
  onDelete,
}: {
  video: ReportVideo;
  memberId: number;
  canDelete?: boolean;
  onDelete?: (videoReportId: number) => Promise<void>;
}) {
  const { org } = useCurrentOrg();
  const queryClient = useQueryClient();
  const processing = useQuery({
    queryKey: ["video-report-processing", org?.id, memberId, video.id],
    queryFn: () => reportsService.videoProcessingStatus(org!.id, memberId, video.id!),
    enabled: Boolean(org && video.id),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.stages?.some((stage) => ["queued", "processing"].includes(stage.status))
        ? 5_000
        : data && ["queued", "processing"].includes(data.status ?? "") ? 5_000 : false;
    },
  });
  const summaryStatus = processing.data?.stages?.find((stage) => stage.stage === "summarize")?.status;
  useEffect(() => {
    if (summaryStatus === "ready") {
      void queryClient.invalidateQueries({ queryKey: ["employee-report-detail", org?.id, memberId] });
      void queryClient.invalidateQueries({ queryKey: ["employee-report", org?.id] });
    }
  }, [summaryStatus, org?.id, memberId, queryClient]);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [detectedDuration, setDetectedDuration] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (processing.data?.status === "ready" && !hasStartedPlayback) {
      videoRef.current?.load();
      setPlaybackError(false);
    }
  }, [processing.data?.status, hasStartedPlayback]);

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

      {processing.data && ["queued", "processing"].includes(processing.data.status ?? "") ? (
        <p className="mt-3 text-sm text-muted-foreground">Видео сохранено. Готовим его для просмотра и отправки…</p>
      ) : processing.data?.status === "failed" ? (
        <p className="mt-3 text-sm text-destructive">Не удалось подготовить видео. Исходный файл сохранён.</p>
      ) : null}
      {summaryStatus && ["queued", "processing"].includes(summaryStatus) ? (
        <p className="mt-2 text-sm text-muted-foreground">Формируем краткий отчёт из аудио…</p>
      ) : summaryStatus === "failed" ? (
        <p className="mt-2 text-sm text-destructive">Краткий отчёт не сформирован. Видео можно отправить с пояснением.</p>
      ) : null}
      <div className="mt-4">
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
                  // Не скачиваем большой оригинал при открытии страницы.
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

        <dl className="mt-3 grid gap-1 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt>Загружен</dt>
            <dd>{video.createdAt ? formatDate(video.createdAt) : "не указано"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Длительность</dt>
            <dd>{detectedDuration || video.duration || "определяется после запуска"}</dd>
          </div>
        </dl>
      </div>
      {deleteError ? <p className="mt-3 text-sm text-destructive">{deleteError}</p> : null}
    </article>
  );
}
