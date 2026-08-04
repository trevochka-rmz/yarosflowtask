# YarosTaskFlow Assistant

Необходимо реализовать система управления задачами внутри 
YarosTaskFlow — это система управления задачами внутри Telegram: руководитель в свободной форме пишет заметку или мысль, backend через Claude API превращает её в детализированное техническое задание (название, описание, критерии приёмки, приоритет, категория), сохраняет ТЗ в бд и при необходимости назначает одному или нескольким сотрудникам; дальше и руководители, и сотрудники в Telegram Mini App (React) видят задачи, меняют статусы, комментируют, правят и отслеживают историю — полный цикл от сырой идеи до выполнения без выхода из Telegram.
В любом случае, будет веб приложение, если если возможность привязкой к телеграм сделай, если нет, то можно обычное веб приложение, как ты умеешь, лого прикрепил к сообщению, используй его везде где нужно лого, далее есть полная документация о маршрутах, куда надо отправлять запрос для работы в env будет базовый url http://localhost:3000/api , создай его, далее по ролям есть две роли manager и employee

Начальная страница удобная страница для ввода текста как в нейронках
Поле ввода текста → POST /api/tasks с { authorId, rawText }

Показать loader (Claude может отвечать несколько секунд)

После ответа открыть карточку задачи с title, description, acceptance_criteria

Далее выдавать ответ в виде таблицы или как будет удобнее красиво главное видел руководитель что результат есть

Кроме также можно посмотреть другие задачи и детали

5. Список и детали

Список: GET /api/tasks/author/:id или /assigned/:id

Детали: GET /api/tasks/:id (там есть assignees)

Назначение: список сотрудников GET /api/users/employees → PATCH /api/tasks/:id/assign с userIds: [2, 3]


и другие детали
6. Статусы

Кнопки по бизнес-логике, например:

employee: assigned → in_progress → review

manager: review → done или назад в in_progress

Запрос: PATCH /api/tasks/:id/status с { status, changedBy }

7. Комментарии

Список: GET /api/comments/task/:taskId

Отправка: POST /api/comments с { taskId, authorId, body }

8. История (опционально)

GET /api/history/task/:taskId — лента изменений

9. Ошибки

Смотреть response.ok и тело { success: false, message }.
Показывать message пользователю. Пока нет Mini App — слать X-Dev-User-Id: 1, вдальнейшем там будет id телеграм, реализую красивый интерфейс, зная лого по цветам его, синий и белый, все запросы в md файле документация полная, сотрудников и детали для удобства можно показывать в виде таблицы

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76f4c92c-3c81-4c27-8a86-38ab06016021).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
