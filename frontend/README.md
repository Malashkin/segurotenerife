# Seguro Tenerife — Frontend

Мультиязычный (EN / ES / UA(uk) / RU) фронтенд сервиса подбора страховки на Тенерифе.
Монорепо из двух приложений и набора FSD-библиотек.

- **apps/web** — публичный лендинг + чат-подбор страховки.
- **apps/admin** — дашборд менеджера со списком лидов.

Лендинг (`apps/web`) собран на слое `pages` (`LandingPage`) и стекует виджеты в
продуктовом порядке: **NavBar → Hero → InsuranceTypes → HowItWorks → ChatWidget
(«подбор», секция `#quiz`) → Articles → Faq → Footer**. Переключатель языка в
шапке меняет весь UI вживую, включая чат.

## Стек

React 18 · TypeScript (strict) · Vite · Tailwind CSS · shadcn-style примитивы ·
i18next + react-i18next · TanStack Query · Zustand · Feature-Sliced Design.

Инструмент монорепо — **pnpm workspaces** (см. примечание ниже про Nx).

## Требования

- Node.js >= 20
- pnpm >= 9

## Команды

```bash
# из каталога frontend/

pnpm install        # установить зависимости всех пакетов воркспейса

pnpm dev:web        # dev-сервер web   (http://localhost:5173)
pnpm dev:admin      # dev-сервер admin (http://localhost:5174)

pnpm build          # production-сборка обоих приложений
pnpm build:web      # только web
pnpm build:admin    # только admin

pnpm typecheck      # strict-проверка типов по всем пакетам
```

Сборка каждого приложения кладёт артефакты в `apps/<app>/dist`.

## Переменные окружения

Vite пробрасывает в бандл только переменные с префиксом `VITE_`.

| Переменная     | Назначение                      | По умолчанию            |
| -------------- | ------------------------------- | ----------------------- |
| `VITE_API_URL` | Базовый URL backend REST API    | `http://localhost:8080` |

Скопируйте `.env.example` в `apps/web/.env.local` / `apps/admin/.env.local`
и при необходимости измените значения.

### Admin API token

Дашборд менеджера (`apps/admin`) запрашивает `GET {VITE_API_URL}/api/leads` с
заголовком `Authorization: Bearer <ADMIN_API_TOKEN>`. Токен **не** хранится в
переменных окружения и не вшивается в бандл: менеджер вводит его один раз в
форме входа (`TokenGate`), после чего он сохраняется только в `localStorage`
браузера (ключ `seguro_admin_token`) и подставляется в Bearer-заголовок каждого
запроса. Неверный токен отбраковывает backend (401) — дашборд покажет ошибку и
вернёт к форме входа. Кнопка «Sign out» очищает токен из браузера.

Значение `ADMIN_API_TOKEN` задаётся на стороне backend; на фронтенде его не
конфигурируют.

## Структура (Feature-Sliced Design)

```
frontend/
├── apps/
│   ├── web/                 # публичное приложение (лендинг + чат)
│   └── admin/               # дашборд менеджера
├── libs/
│   ├── shared/
│   │   ├── ui/              # Atomic Design: atoms / molecules / organisms (shadcn-style)
│   │   ├── i18n/            # инициализация i18next, определение/хранение языка
│   │   ├── api/            # fetch-клиент, QueryClient + QueryProvider, типы лидов
│   │   └── store/          # Zustand-сторы по доменам (клиентское состояние)
│   ├── entities/            # доменные сущности (lead, ...) — пока пусто
│   ├── features/            # сценарии (чат-подбор, отправка лида, переключатель языка)
│   ├── widgets/             # секции лендинга (NavBar, Hero, InsuranceTypes, ...)
│   └── pages/               # целые страницы (LandingPage)
├── tsconfig.base.json       # strict TS + path-алиасы (источник правды)
├── tailwind.preset.cjs      # общие бренд-токены Tailwind
└── pnpm-workspace.yaml
```

### Слои FSD ↔ Atomic Design

- `shared/ui` содержит Atomic Design: **atoms / molecules / organisms**.
- **templates / pages** из Atomic Design маппятся на слои **widgets / pages** FSD.
- Компоненты в `features`/`entities` используют атомы/молекулы из `shared/ui`,
  но сами в иерархию Atomic Design не входят.

## Path-алиасы (импорт библиотек)

Алиасы заданы один раз в `tsconfig.base.json` и читаются Vite через
`vite-tsconfig-paths` — дублировать их в конфиге Vite не нужно.

| Алиас            | Путь                              |
| ---------------- | --------------------------------- |
| `@shared/ui`     | `libs/shared/ui/src/index.ts`     |
| `@shared/i18n`   | `libs/shared/i18n/src/index.ts`   |
| `@shared/api`    | `libs/shared/api/src/index.ts`    |
| `@shared/store`  | `libs/shared/store/src/index.ts`  |
| `@entities`      | `libs/entities/src/index.ts`      |
| `@features`      | `libs/features/src/index.ts`      |
| `@widgets`       | `libs/widgets/src/index.ts`       |
| `@pages`         | `libs/pages/src/index.ts`         |

Пример:

```ts
import { Button } from '@shared/ui';
import { initI18n, changeLocale } from '@shared/i18n';
import { QueryProvider, type CreateLeadRequest } from '@shared/api';
```

## Заметки для контентных агентов

- **Публичный API библиотеки.** Каждый слой экспортирует только через свой
  `src/index.ts`. Чтобы добавить компонент/хук наружу — создайте файл внутри
  слоя и допишите строку реэкспорта в `index.ts`. Импортировать внутренние
  пути напрямую (минуя alias) нельзя.
- **Где инициализируется i18n.** `libs/shared/i18n/src/init.ts` (`initI18n()`).
  Вызывается один раз в app-слое каждого приложения: `apps/web/src/main.tsx`,
  `apps/admin/src/main.tsx`. Язык: localStorage → язык браузера (`be`→`ru`) → `en`.
  Порядок переключателя и подписи — `LOCALE_ORDER` / `LOCALE_LABELS` в
  `libs/shared/i18n/src/config.ts`. Словари лендинга/квиза/FAQ портированы из
  `I18N` прототипа в `libs/shared/i18n/src/locales/<lng>/common.json` (один
  namespace `common`, по файлу на язык); словарь чата (`CHAT_I18N`) — в
  `libs/features/src/chat/model/chatDict.ts`.
- **Где живёт QueryClient/провайдер.** `libs/shared/api/src/QueryProvider.tsx`
  (+ `queryClient.ts`). Провайдер уже подключён в `main.tsx` обоих приложений.
  Хуки данных (`useCreateLead`, `useLeads`) пишите в `entities`/`features`
  поверх `apiRequest` из `@shared/api` — «голый» fetch в компонентах запрещён.
- **Контракт лидов** типизирован в `libs/shared/api/src/types.ts`
  (`CreateLeadRequest`, `LeadRow`, ...). Мессенджеры: WhatsApp / Telegram / Viber
  (без Instagram).
- **Как приложения подключают библиотеки.** Через workspace-зависимости
  (`"@seguro/shared-ui": "workspace:*"`) и алиасы выше. Vite транспилирует
  исходники библиотек напрямую — отдельная сборка libs не нужна.
- **Дисклеймер в футере** (обязателен): сервис информационный, не страховщик и
  не брокер; заявки передаются лицензированному офису-партнёру.

## Почему pnpm workspaces, а не Nx

Задача предполагала Nx, но генератор `create-nx-workspace` в этом окружении
ненадёжен (интерактивные промпты / сеть). Рабочий монорепо важнее, поэтому
выбран pnpm-workspaces. Структура полностью совместима с FSD; при желании поверх
неё позже можно добавить Nx (каждый пакет уже изолирован и имеет свой
`package.json`/`tsconfig.json`).
```
