import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useCurrentOrg } from "@/lib/org";
import {
  isoDate,
  MAX_VIDEO_REPORT_SIZE,
  MAX_VIDEO_REPORT_SIZE_MB,
  reportsService,
  type UploadedVideoReport,
} from "@/lib/reports";

export function VideoReportUpload({
  employee,
  onUploaded,
  defaultReportDate,
  alreadyUploaded = false,
}: {
  employee: { id: number; full_name: string | null };
  onUploaded: (uploaded: UploadedVideoReport) => void;
  defaultReportDate?: string;
  alreadyUploaded?: boolean;
}) {
  const { org } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const today = isoDate(new Date());
  const [reportDate, setReportDate] = useState(defaultReportDate ?? today);
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [uploadProgress, setUploadProgress] = useState<number>();
  const uploadAbortRef = useRef<AbortController>();
  const upload = useMutation({
    mutationFn: async () => {
      const abortController = new AbortController();
      uploadAbortRef.current = abortController;
      return reportsService.uploadVideo(
        org!.id,
        employee.id,
        reportDate,
        file!,
        setUploadProgress,
        abortController.signal,
      );
    },
    onSuccess: (uploaded) => {
      setOpen(false);
      setFile(undefined);
      setFileError(undefined);
      setUploadProgress(undefined);
      onUploaded(uploaded);
    },
    onSettled: () => {
      uploadAbortRef.current = undefined;
    },
  });

  const cancelUploadAndClose = () => {
    uploadAbortRef.current?.abort();
    setOpen(false);
    setFile(undefined);
    setFileError(undefined);
    setUploadProgress(undefined);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setOpen(true);
      return;
    }

    upload.reset();
    if (selectedFile.size > MAX_VIDEO_REPORT_SIZE) {
      setFile(undefined);
      setFileError(`Размер видеоотчёта не должен превышать ${MAX_VIDEO_REPORT_SIZE_MB} МБ`);
      event.target.value = "";
      setOpen(true);
      return;
    }
    setFile(selectedFile);
    setFileError(undefined);
    event.target.value = "";
    setOpen(true);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && upload.isPending) {
            cancelUploadAndClose();
            return;
          }
          setOpen(nextOpen);
        }}
      >
        <Button
          type="button"
          className="ml-auto"
          variant={alreadyUploaded ? "secondary" : "default"}
          disabled={alreadyUploaded}
          onClick={() => {
            setReportDate(defaultReportDate ?? today);
            setFileError(undefined);
            setUploadProgress(undefined);
            upload.reset();
            setOpen(true);
          }}
        >
          <Upload className="mr-2 h-4 w-4" />
          {alreadyUploaded ? "Видеоотчет добавлен" : "Добавить видеоотчет"}
        </Button>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить видеоотчет</DialogTitle>
            <DialogDescription>
              {employee.full_name || "Сотрудник"}. Видео будет добавлено за дату,
              выбранную на странице отчётов.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (file && !upload.isPending) {
                setUploadProgress(0);
                upload.mutate();
              }
            }}
          >
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Дата отчёта: </span>
              <time dateTime={reportDate} className="font-medium">
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${reportDate}T12:00:00`))}
              </time>
            </div>
            <div className="space-y-1.5 text-sm font-medium">
              <p>Видео (до {MAX_VIDEO_REPORT_SIZE_MB} МБ)</p>
              <div
                className={`relative flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 font-normal focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${upload.isPending ? "opacity-50" : "hover:bg-accent hover:text-accent-foreground"}`}
              >
                <Upload className="mr-2 h-4 w-4" />
                <span>{file ? "Выбрать другое видео" : "Выбрать видео"}</span>
                {/* Нативное поле занимает всю кнопку: iOS получает прямое
                    нажатие и устойчивую область для системного меню выбора.
                    Диалог остаётся смонтированным, включая при отмене выбора. */}
                <input
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  type="file"
                  accept="video/*"
                  aria-label={file ? "Выбрать другое видео" : "Выбрать видео"}
                  disabled={upload.isPending}
                  onChange={handleFileChange}
                />
              </div>
            </div>
            {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
            <p className="text-xs text-muted-foreground">
              После загрузки автоматически сформируем краткий отчёт из аудио видео.
              Он появится на странице и будет добавлен к сообщению при отправке.
            </p>
            {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
            {upload.isPending ? (
              <div
                className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3"
                aria-live="polite"
              >
                <Progress value={uploadProgress ?? 0} />
                <p className="text-sm font-medium">
                  {uploadProgress === undefined || uploadProgress < 100
                    ? `Загружаем видео: ${uploadProgress ?? 0}%`
                    : "Видео отправлено. Сохраняем файл…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Можно закрыть окно, если передумали — загрузка будет отменена.
                </p>
              </div>
            ) : null}
            {upload.isError ? (
              <p className="text-sm text-destructive">{upload.error.message}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={!file || upload.isPending}>
                {upload.isPending ? "Загружаем…" : "Загрузить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
