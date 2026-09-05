---
audience: [seo]
owner: seguro-tenerife
updated: 2026-09-05
---

# Реестр экспериментов

Каждая правка ради трафика записывается сюда **в момент внесения**, с метрикой
«до». Задним числом её восстановить нельзя: Search Console не хранит срезы по
запросу на произвольную дату.

Через 14 дней `/seo-monthly` сравнивает и выносит вердикт. Смысл реестра —
чтобы приёмы отбирались по результату, а не по убеждению.

## Как заполнять

| Дата | Что сделано | Страница | Целевой запрос | Позиция до | Показы до | Вердикт |
|---|---|---|---|---|---|---|
| ГГГГ-ММ-ДД | переписан сниппет / дописан раздел / новая статья | URL | запрос | X.X | N | — |

Вердикты: `сработало` · `не сработало` · `рано судить` · `—` (ждёт срока)

## Записи

Срез «до» снят 2026-09-05 за окно 2026-08-07 — 2026-09-03. Правки ставятся
копирайтеру задачами SEGU-4.1…4.5; вердикт выносит `/seo-monthly` не раньше
2026-10-05 (14 дней после внесения + переиндексация).

| Дата | Что сделано | Страница | Целевой запрос | Позиция до | Показы до | Вердикт |
|---|---|---|---|---|---|---|
| 2026-09-05 | переписан сниппет: `seguro DNV` выведен в начало title | `/es/blog/digital-nomad-visa-insurance/` | seguro dnv | 4.7 | 28 | — |
| 2026-09-05 | переписан сниппет: гео «Tenerife» в title+description | `/es/blog/funeral-insurance-spain/` | seguro decesos tenerife | 11.9 | 15 | — |
| 2026-09-05 | переписан сниппет: гео «Tenerife» в title | `/es/blog/pet-insurance-spain/` | seguros de mascotas en tenerife | 12.0 | 2 | — |
| 2026-09-05 | переписан сниппет: формулировка `accident cover` вместо `accident insurance` | `/en/blog/accident-insurance-spain/` | accident cover in spain | 13.7 | 3 | — |
| 2026-09-05 | 4 раздела прямых ответов про Tenerife + новый title | `/en/blog/private-vs-public-healthcare-spain/` | what is a public health charge in tenerife | 5.6 | 20 | — |
| 2026-09-05 | 4 раздела прямых ответов про Tenerife + новый title | `/en/blog/private-vs-public-healthcare-spain/` | public/state medical centres in tenerife | 32.0 | 40 | — |
| 2026-09-05 | 4 раздела прямых ответов про Tenerife + новый title | `/en/blog/private-vs-public-healthcare-spain/` | healthcare system in tenerife | 28.8 | 30 | — |
| 2026-09-05 | дописан гео-раздел «Tenerife / Canarias» | `/es/blog/life-insurance-spain/` | seguros de vida en tenerife | 81.1 | 32 | — |
| 2026-09-05 | дописан гео-раздел «Tenerife / Canarias» | `/es/blog/life-insurance-spain/` | seguro de vida en tenerife | 73.5 | 26 | — |
| 2026-09-05 | новая статья `travel-insurance-tenerife` (4 локали) | `/en/blog/travel-insurance-coming-to-spain/` (донор показов) | tenerife travel insurance | 64.7 | 126 | — |

## Проверяемая гипотеза

**H1 (гео-модификатор).** Если целевой гео-запрос вынести в title, страница
поднимается заметно (≥5 позиций). Проверяется строками про `decesos`, `mascotas`,
`life-insurance` и `private-vs-public-healthcare` — все четыре меняют именно гео,
при неизменном теле статьи в первых двух случаях. Если позиции у `decesos` и
`mascotas` (только сниппет, тело не тронуто) не сдвинутся, гипотеза не работает и
дальше вкладываемся только в глубину текста.

`private-vs-public-healthcare` для H1 чистым замером не является: там вместе с
title выросло и тело (539 → 1208 слов, четыре новых раздела прямых ответов),
так что эта строка проверяет связку «гео в title + глубина», а не гео само по
себе.
