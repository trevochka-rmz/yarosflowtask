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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCurrentOrg } from "@/lib/org";
import { isoDate, MAX_VIDEO_REPORT_SIZE, reportsService } from "@/lib/reports";

export function VideoReportUpload({
  employee,
  onUploaded,
  defaultReportDate,
  alreadyUploaded = false,
}: {
  employee: { id: number; full_name: string | null };
  onUploaded: () => void;
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
    onSuccess: () => {
      setOpen(false);
      setFile(undefined);
      setFileError(undefined);
      setUploadProgress(undefined);
      onUploaded();
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

  return (
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
            {employee.full_name || "Сотрудник"}. Можно выбрать сегодня или прошедшую дату.
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
          <label className="block space-y-1.5 text-sm font-medium">
            Дата отчёта
            <Input
              type="date"
              value={reportDate}
              max={today}
              onChange={(event) => setReportDate(event.target.value)}
              disabled={upload.isPending}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Видео (до 200 МБ)
            <Input
              type="file"
              accept="video/*"
              disabled={upload.isPending}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                upload.reset();
                if (selectedFile && selectedFile.size > MAX_VIDEO_REPORT_SIZE) {
                  setFile(undefined);
                  setFileError("Размер видеоотчёта не должен превышать 200 МБ");
                  event.target.value = "";
                  return;
                }
                setFile(selectedFile);
                setFileError(undefined);
              }}
              required
            />
          </label>
          {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
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
  );
}
