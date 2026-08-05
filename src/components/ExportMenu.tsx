import { useState } from "react";
import { Download, FileArchive, FileCode2, FileText, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { exportTask, type ExportFormat } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPTIONS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
  { format: "md", label: "Markdown (.md)", icon: FileCode2 },
  { format: "docx", label: "Word (.docx)", icon: FileType2 },
  { format: "pdf", label: "PDF", icon: FileText },
  { format: "zip", label: "ZIP + вложения", icon: FileArchive },
];

interface ExportMenuProps {
  taskId: number;
  variant?: "icon" | "button";
  className?: string;
}

export function ExportMenu({ taskId, variant = "icon", className }: ExportMenuProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await exportTask(taskId, format);
      toast.success("Файл выгружен");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Экспорт задачи"
            title="Экспорт задачи"
            className={cn("h-9 w-9 shrink-0 text-muted-foreground hover:text-primary", className)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        ) : (
          <Button variant="outline" className={cn("w-full sm:w-auto", className)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Экспорт
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Экспорт задачи</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            disabled={busy !== null}
            onSelect={(e) => {
              e.preventDefault();
              void run(format);
            }}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
