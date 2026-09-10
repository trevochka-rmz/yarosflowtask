import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Длинный текст: на мобильных свёрнут, разворачивается по кнопке. */
export function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const normalized = String(text ?? "")
    .replace(/\s*Требует уточнения\s*:[\s\S]*$/gi, "")
    .trim();
  const long = normalized.length > 180;
  const blocks = normalized.split(/^(h3\.\s*.+)$/gim).filter(Boolean);

  const content = (
    <>
      {blocks.map((block, index) => {
        const heading = block.match(/^h3\.\s*(.+)$/i);
        return heading ? (
          <h3 key={index} className="mt-3 text-sm font-semibold first:mt-0">
            {heading[1]}
          </h3>
        ) : (
          <div key={index} className="whitespace-pre-wrap">
            {block.trim()}
          </div>
        );
      })}
    </>
  );

  if (!long) return <div>{content}</div>;

  return (
    <div>
      <div
        className={cn("whitespace-pre-wrap", !open && "sm:line-clamp-none")}
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
      >
        {content}
      </div>
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
