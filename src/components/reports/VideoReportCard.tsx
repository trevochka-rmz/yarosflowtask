import { useState } from "react";
import { ExternalLink, FileVideo, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/api";
import type { ReportVideo } from "@/lib/reports";

export function VideoReportCard({ video }: { video: ReportVideo }) {
  const hasSummary = Boolean(
    video.summary?.completed || video.summary?.problems || video.summary?.plans,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

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
        {video.url ? (
          <Button asChild variant="outline" size="sm">
            <a href={video.url} target="_blank" rel="noreferrer">
              Открыть видео
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(16rem,1fr)] lg:items-center">
        <div>
          <div className="overflow-hidden rounded-xl bg-black">
            {video.url ? (
              <video
                className="aspect-video w-full object-contain"
                controls
                playsInline
                // MinIO currently ignores HTTP Range. Do not delay opening a
                // report until an entire video has been downloaded.
                preload="none"
                src={video.url}
                onLoadStart={() => {
                  setIsLoading(true);
                  setPlaybackError(false);
                }}
                onCanPlay={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setPlaybackError(true);
                }}
              >
                Ваш браузер не поддерживает воспроизведение видео.
              </video>
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                Видеофайл недоступен
              </div>
            )}
          </div>
          {isLoading ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Загружаем видео…
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
              <dd>{video.duration || "не указана"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
