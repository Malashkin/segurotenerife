# Seguro Tenerife — Frontend

Мультиязычный (EN / ES / UA(uk) / RU) фронтенд сервиса подбора страховки на Тенерифе.
Монорепо из двух приложений и набора FSD-библиотек.

- **apps/web-astro** — публичный лендинг на **Astro** (SSG + React-острова): мультиязычный
  SEO/GEO (статический HTML по локалям `/`,`/es/`,`/uk/`,`/en/`, hreflang, JSON-LD FAQPage).
  Подробности — `../docs/architecture/astro-web.md`. (Прежний Vite-SPA `apps/web` удалён.)
- **apps/admin** — дашборд менеджера со списком лидов (Vite-SPA).

Лендинг (`apps/web-astro`) — статические секции `.astro` в продуктовом порядке
(**NavBar → Hero → TrustBar → InsuranceTypes → HowItWorks → Articles → Faq →
Footer**) + один React-остров плавающего UI (чат-подбор + правовая модалка + куки),
переиспользующий FSD-библиотеки. Переключатель языка — ссылки на локальные URL
(`/`,`/es/`,`/uk/`,`/en/`). См. `../docs/architecture/astro-web.md`.

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

Скопируйте `.env.example` в `apps/web-astro/.env` / `apps/admin/.env.local`
и при необходимости измените значения. (Astro читает `VITE_*` из `.env` —
см. `envPrefix` в `apps/web-astro/astro.config.mjs`.)

### Аутентификация менеджера (Волна 3)

Дашборд менеджера (`apps/admin`) логинится по паролю: форма входа (`LoginGate`)
шлёт `POST {VITE_API_URL}/api/auth/login` и получает короткоживущий **access-токен
в память** (не в localStorage — защита от XSS) и **refresh-токен в httpOnly-cookie**.
Список лидов (`GET /api/leads`) запрашивается с `Authorization: Bearer <access>`.

Сессия держится на refresh-cookie: при загрузке дашборд тихо дергает
`POST /api/auth/refresh` и восстанавливает доступ без повторного ввода пароля; на
`401` (access истёк) повтор refresh выполняется автоматически. «Sign out» зовёт
`POST /api/auth/logout` (backend стирает cookie). Сам пароль на backend хранится
только как argon2-хэш (`MANAGER_PASSWORD_HASH`) — на фронтенде не конфигурируется.

> Для cookie-логина из браузера backend должен отдавать конкретный `ALLOWED_ORIGINS`
> (домен дашборда, не `*`) — запросы идут с `credentials: 'include'`.

## Структура (Feature-Sliced Design)

```
frontend/
├── apps/
│   ├── web-astro/           # публичный лендинг на Astro (SSG + React-острова)
│   └── admin/               # дашборд менеджера (Vite-SPA)
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
  Admin (`apps/admin/src/main.tsx`) вызывает `initI18n()` (язык: localStorage →
  браузер → `en`). На Astro-лендинге язык задаётся URL-роутингом, а остров
  `Overlays` вызывает `initI18n({ lng })` с локалью страницы.
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
