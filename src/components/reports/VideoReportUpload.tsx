import { useState } from "react";
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
import { useCurrentOrg } from "@/lib/org";
import { isoDate, reportsService } from "@/lib/reports";

export function VideoReportUpload({
  employee,
  onUploaded,
}: {
  employee: { id: number; full_name: string | null };
  onUploaded: () => void;
}) {
  const { org } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [reportDate, setReportDate] = useState(isoDate(new Date()));
  const [file, setFile] = useState<File>();
  const upload = useMutation({
    mutationFn: () => reportsService.uploadVideo(org!.id, employee.id, reportDate, file!),
    onSuccess: () => {
      setOpen(false);
      setFile(undefined);
      onUploaded();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" className="ml-auto" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Добавить видеоотчет
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
            if (file && !upload.isPending) upload.mutate();
          }}
        >
          <label className="block space-y-1.5 text-sm font-medium">
            Дата отчёта
            <Input
              type="date"
              value={reportDate}
              max={isoDate(new Date())}
              onChange={(event) => setReportDate(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Видео (до 200 МБ)
            <Input
              type="file"
              accept="video/*"
              onChange={(event) => setFile(event.target.files?.[0])}
              required
            />
          </label>
          {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
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
