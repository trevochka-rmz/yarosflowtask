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
  const analysis = raw.split(/^ОТЧЕТ СОТРУДНИКА[ \t]*\r?$/m)[0];
  const projectBlocks = [
    ...analysis.matchAll(
      /^\*([^*\r\n]+)\*[ \t]*\r?\n([\s\S]*?)(?=^\*[^*\r\n]+\*[ \t]*\r?$|^ОТЧЕТ СОТРУДНИКА\s*$|(?![\s\S]))/gm,
    ),
  ];
  const projects = projectBlocks
    .map(([, name, body]) => {
      // Итог проекта может включать коммиты, отсутствующие в текстовом анализе.
      const projectStats = body.match(/СТАТИСТИКА ПО ПРОЕКТУ:[^\r\n]*/i)?.[0];
      const statistics = projectStats
        ? [projectStats]
        : [...body.matchAll(/\*\*Статистика:\*\*([^\r\n]*)/gi)].map((match) => match[1]);
      const sum = (pattern: RegExp) => {
        const values = statistics.flatMap((stat) => {
          const value = stat.match(pattern)?.[1];
          return value ? [Number(value.replace(/\s/g, ""))] : [];
        });
        return values.length
          ? String(values.reduce((total, value) => total + value, 0))
          : undefined;
      };
      return {
        name: name.trim(),
        added: sum(/\+(\d[\d\s]*)/),
        removed: sum(/-(\d[\d\s]*)/),
        total: sum(/всего изменено:\s*([\d\s]+)/i),
      };
    })
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
