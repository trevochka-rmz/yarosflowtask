# AGENTS.md

## Что это за проект

Фронтенд **TaskFlow** — React Mini App, интерфейс той же организационной системы, что описана
в бэкенде (задачи, боты, интеграции, аудит, отделы, роли). Живёт на домене
`https://flowtask.yaros.kg`, роутинг через **TanStack Router** (файловая маршрутизация,
`src/routes/`), данные — через **TanStack Query**.

## Стек

- **React** + **TanStack Router** (file-based routing, `routeTree.gen.ts` генерируется — не
  редактируй его руками)
- **TanStack Query** — вся работа с сервером (кэш, инвалидация, мутации)
- **shadcn/ui** — компоненты в `src/components/ui/` (это сгенерированные примитивы: правь
  только при явной необходимости, предпочитай оборачивать/расширять, а не переписывать)
- **Tailwind** — стилизация

## Два бэкенда — не перепутай, к какому стучаться

Проект работает с **двумя независимыми API**, у них разное назначение и разная авторизация:

### 1. Основной backend — `VITE_API_BASE_URL`

- Обёртка: `src/lib/api.ts` (`API_BASE_URL`, `apiFetch`)
- Всё, кроме эквайринга: задачи, боты, организации, отделы, роли, аудит, чаты, интеграции
  Jira/Bitrix, профиль пользователя, аватарки
- Авторизация: `authHeaders()` из `src/lib/auth.ts` — сначала пробует `X-Telegram-Init-Data`
  (если открыто внутри Telegram Mini App), потом `Authorization: Bearer <token>` (веб-логин),
  в dev-режиме — фолбэк `X-Dev-User-Id`
- Формат ответа: `{ success: true, data: ... }` / `{ success: false, message: "..." }`

### 2. Второй backend — `VITE_API_SECOND_URL`

- Обёртка: `src/lib/acquiring.ts` (`API_SECOND_URL`, `acquiringApi`)
- **Используется только для страниц эквайринга** (`src/routes/acquiring.tsx`,
  `src/routes/acquiring.$terminalId.tsx`) — регистрация и учёт терминалов/эквайринга
- Это отдельный, изолированный сервис — **не расширяй его использование на другие страницы**.
  Если для новой (не эквайринг) фичи кажется, что нужен этот бэкенд — это повод остановиться
  и спросить, а не тащить `acquiringApi` в другой роут.
- Простая auth-модель (не Telegram-based, свой формат — смотри `authHeaders` внутри
  `acquiring.ts`, если он определён отдельно от основного).

**Правило:** новый функционал по умолчанию идёт через основной `api.ts`. Второй бэкенд трогай
только если явно работаешь с разделом «Эквайринг».

## Авторизация

- `TELEGRAM_BOT_USERNAME` захардкожен в `src/lib/auth.ts` — Telegram Login Widget на вебе,
  `window.Telegram.WebApp.initData` внутри Mini App.
- Токен веб-сессии хранится в `localStorage` (`yaros.token`), меняется через `setToken`/
  `clearToken`. При изменении токена стреляет кастомное событие `yaros:auth-changed` — если
  правишь логику авторизации, не убирай этот `dispatchEvent`, на него подписаны другие части
  приложения (проверяют текущего пользователя).
- Организация выбирается отдельно от авторизации: `src/lib/org.ts` /
  `useCurrentOrg`/`useMyOrgs` — многие ручки основного API требуют явного `organizationId`.

## Роли и права на фронте

Роли (`MemberRole` в `src/lib/platform.ts`) совпадают с ролями бэкенда: `manager`, `employee`,
`bot_owner`, `bot_user`, `power_user`, `integration_admin`, `security_officer`,
`platform_admin`, `director`, `auditor`, `group_participant`. При скрытии/показе UI-элементов
по ролям — сверяйся с этим списком, не изобретай новые роли на фронте без соответствующей
поддержки на бэкенде.

## Задачи — источник данных

Тип `Task` в `src/lib/api.ts` содержит поле `source: "internal" | "jira" | null`. Если задача
из Jira — заполнены `jira_*` поля (`jira_key`, `jira_status`, `jira_assignee` и т.д.), для
`internal` они пустые. Не показывай Jira-специфичный UI (ссылка на Jira, статус синка) для
внутренних задач без проверки `source`/`is_jira`.

## Правила работы для агента

- Не редактируй `src/routeTree.gen.ts` — он генерируется TanStack Router из файлов в
  `src/routes/`. Меняй сами файлы роутов, дерево перегенерируется само.
- Новый роут — создавай файл в `src/routes/` по конвенции TanStack Router
  (`имя.tsx` → `/имя`, `имя.$param.tsx` → `/имя/:param`, `имя.index.tsx` → `/имя` индексный).
- Все серверные запросы — через `TanStack Query` (`useQuery`/`useMutation`), не через сырой
  `fetch` в компонентах напрямую.
- UI-примитивы бери из `src/components/ui/` (shadcn) прежде чем писать новый компонент с нуля.
- Для нового API-запроса к основному бэкенду — добавляй функцию в `src/lib/api.ts` рядом с
  существующими, переиспользуй `apiFetch`/`authHeaders`, не дублируй логику авторизации.
- Меняя типы (`Task`, `User`, `Assignee` и т.д.) в `src/lib/api.ts` — сверяйся со схемой на
  бэкенде (`utils/backup_structure.sql` в бэкенд-репозитории), чтобы не разойтись с реальными
  полями БД.
