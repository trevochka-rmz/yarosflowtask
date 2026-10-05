import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/git-report-parser.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { parseGitReport } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const commits = [
  ["b6c22ed4", 47, 6],
  ["06c0d363", 98, 24],
  ["33269412", 90, 94],
  ["57ed1653", 156, 4],
  ["b766bd4a", 52, 39],
  ["25e18400", 9, 7],
  ["e0933323", 51, 8],
  ["192675ad", 5, 6],
];
const analysis = commits
  .map(
    ([hash, added, removed]) =>
      `### Отчет по коммиту ${hash}\n**Анализ кода:** Изменения коммита ${hash}.\n**Статистика:** +${added} / -${removed} строк (всего изменено: ${added + removed})`,
  )
  .join("\n\n");
const report = `Всего отработано 13,26 ч. (02.10.2026)\n\nАНАЛИЗ ИИ\n*Obshepit*\nt:≈ 0,01 ч. : ${analysis}\n\nСТАТИСТИКА ПО ПРОЕКТУ: +2\u00a0530 / -486 строк (всего изменено: 3\u00a0016)\n\nОТЧЕТ СОТРУДНИКА\n*Все заказчики: 0/8 172,57*\nCS-Cart: описание работы\n*Всего отработано 13,26 ч.*\n\n*Нет новых задач*\n\n*ВЫПОЛНЕННЫЕ:*\n`;

test("2 октября: итог проекта имеет приоритет, все восемь анализов сохраняются", () => {
  const parsed = parseGitReport(report);
  assert.deepEqual(parsed.projects, [
    { name: "Obshepit", added: "2530", removed: "486", total: "3016" },
  ]);
  for (const [hash] of commits) assert.ok(parsed.summary.includes(hash));
  assert.ok(!parsed.summary.includes("CS-Cart"));
  assert.ok(!parsed.summary.includes("СТАТИСТИКА ПО ПРОЕКТУ"));
});

test("без итога суммируются все коммиты; несколько проектов и CRLF", () => {
  const parsed = parseGitReport(
    `*Первый*\n${analysis}\n*Второй*\n**Статистика:** +10 / -0 строк (всего изменено: 10)`.replace(
      /\n/g,
      "\r\n",
    ),
  );
  assert.deepEqual(parsed.projects, [
    { name: "Первый", added: "508", removed: "188", total: "696" },
    { name: "Второй", added: "10", removed: "0", total: "10" },
  ]);
});

test("пустой отчёт и ошибка квоты", () => {
  assert.equal(parseGitReport(""), null);
  const parsed = parseGitReport(
    "*Проект*\nОШИБКА GPT: 429\nСТАТИСТИКА ПО ПРОЕКТУ: +1 / -0 строк (всего изменено: 1)",
  );
  assert.equal(parsed.projects[0].added, "1");
  assert.match(parsed.summary, /временно недоступен/);
});
