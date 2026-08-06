import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Длинный текст: на мобильных свёрнут, разворачивается по кнопке. */
export function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = (text ?? "").length > 180;

  if (!long) return <p className="whitespace-pre-wrap">{text}</p>;

  return (
    <div>
      <p
        className={cn("whitespace-pre-wrap", !open && "sm:line-clamp-none")}
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {open ? (
          <>
            Свернуть <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Показать полностью <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>
    </div>
  );
}
