import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, fileUrl, type Attachment } from "@/lib/api";

export function formatBytes(size?: number | null) {
  if (!size || size <= 0) return "";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = size;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Выбор файлов до создания задачи (без запроса на сервер). */
export function FilePicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) onChange([...files, ...picked]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
        Файлы{files.length ? ` (${files.length})` : ""}
      </Button>
    </div>
  );
}

export function PickedFiles({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-2 pb-2">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${i}`}
          className="flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs"
        >
          <span className="truncate">{f.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
          <button
            type="button"
            aria-label={`Убрать ${f.name}`}
            className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AttachmentIcon({ item }: { item: Attachment }) {
  const isImage = item.file_type === "photo" || (item.mime_type ?? "").startsWith("image/");
  return isImage ? (
    <ImageIcon className="h-4 w-4 text-primary" />
  ) : (
    <FileText className="h-4 w-4 text-primary" />
  );
}

/** Список вложений задачи с загрузкой и удалением. */
export function TaskAttachments({ taskId, userId }: { taskId: number; userId: number }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => api.attachments(taskId),
  });

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      await api.uploadAttachments(taskId, userId, files);
      await queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
      toast.success("Файлы загружены");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
      toast.success("Вложение удалено");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Вложения</h2>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            void upload(picked);
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Прикрепить файлы"
          title="Прикрепить файлы"
          className="h-9 w-9 text-muted-foreground hover:text-primary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
      </div>

      {query.isPending ? (
        <div className="mt-3 h-10 animate-pulse rounded bg-muted" />
      ) : query.isError ? (
        <p className="mt-2 text-sm text-destructive">{(query.error as Error).message}</p>
      ) : query.data?.length ? (
        <ul className="mt-3 space-y-2">
          {query.data.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5"
            >
              <AttachmentIcon item={item} />
              <a
                href={fileUrl(item.url)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm font-medium hover:underline">
                  {item.file_name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatBytes(item.file_size)}
                </span>
              </a>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Удалить ${item.file_name}`}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Файлов пока нет.</p>
      )}
    </section>
  );
}
