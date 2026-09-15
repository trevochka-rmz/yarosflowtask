export type ParsedGitReport = {
  raw: string;
  workedHours?: string;
  summary: string;
  projects: Array<{ name: string; added?: string; removed?: string; total?: string }>;
  newTasks?: string;
  completedTasks?: string;
};
export function parseGitReport(raw?: string): ParsedGitReport | null {
  if (!raw?.trim()) return null;
  const hours = raw.match(/Всего отработано\s+([^\n*]+)/i)?.[1]?.trim();
  const projectBlocks = [...raw.matchAll(/\*([^*\n]+)\*\s*\n([\s\S]*?)(?=\n\s*\*[^*\n]+\*|$)/g)];
  const projects = projectBlocks
    .map(([, name, body]) => ({
      name: name.trim(),
      added: body.match(/\+(\d[\d\s]*)/)?.[1],
      removed: body.match(/-(\d[\d\s]*)/)?.[1],
      total: body.match(/всего изменено:\s*([\d\s]+)/i)?.[1],
    }))
    .filter((x) => x.added || x.removed);
  const quotaError = /ОШИБКА GPT:\s*429|insufficient_quota|credit_balance_exhausted/i.test(raw);
  const summary = quotaError
    ? "Анализ ИИ временно недоступен: закончились токены или лимит API. Техническая статистика по изменениям показана в блоке «Проекты и изменения»."
    : projectBlocks
        .map(([, , body]) =>
          body
            .replace(/СТАТИСТИКА ПО ПРОЕКТУ:[\s\S]*/i, "")
            .replace(/^\s*t:\s*≈?\s*[\d,.]+\s*ч\.\s*:\s*/i, "")
            .trim(),
        )
        .filter(Boolean)
        .join("\n\n") || "В отчете нет текстовой сводки по изменениям.";
  return {
    raw,
    workedHours: hours,
    summary,
    projects,
    newTasks: raw.match(/Нет новых задач/i)?.[0],
    completedTasks: raw.match(/ВЫПОЛНЕННЫЕ:\s*([\s\S]*)/i)?.[1]?.trim(),
  };
}
