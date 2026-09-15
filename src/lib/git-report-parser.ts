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
  const projectBlocks = [
    ...raw.matchAll(/\*([^*\n]+)\*\s*\n([\s\S]*?)(?=\n\s*\*[^*\n]+\*|$)/g),
  ];
  const projects = projectBlocks
    .map(([, name, body]) => ({
      name: name.trim(),
      added: body.match(/\+(\d[\d\s]*)/)?.[1],
      removed: body.match(/-(\d[\d\s]*)/)?.[1],
      total: body.match(/всего изменено:\s*([\d\s]+)/i)?.[1],
    }))
    .filter((x) => x.added || x.removed);
  const section = raw.split(/ОТЧЕТ СОТРУДНИКА/i)[1] || raw;
  const summary = section
    .replace(/\*[^*]+\*/g, "").replace(/СТАТИСТИКА ПО ПРОЕКТУ:[\s\S]*/gi, "")
    .trim()
    .split(/\n\s*\n/)
    .slice(0, 2)
    .join("\n\n");
  return {
    raw,
    workedHours: hours,
    summary,
    projects,
    newTasks: raw.match(/Нет новых задач/i)?.[0],
    completedTasks: raw.match(/ВЫПОЛНЕННЫЕ:\s*([\s\S]*)/i)?.[1]?.trim(),
  };
}
