# Домены под SEO/GEO — исследование и рекомендация

Цель: выбрать домен(ы) для Seguro Tenerife — сервиса подбора страховок на
Тенерифе для приезжих (ru/uk/en/es), оптимальный для SEO и гео-таргетинга
(Испания/Канары/Тенерифе), при международной аудитории искателей.

Метод: реальная проверка доступности через `whois` + DNS (июнь 2026) и сверка с
актуальными практиками международного SEO (ccTLD vs gTLD, hreflang).

---

## TL;DR — что брать

1. **`segurotenerife.com` — ОСНОВНОЙ (свободен ✅).** Точное совпадение с брендом,
   ключевые слова «seguro» (страховка, ES) + «tenerife» (гео), `.com` — универсален
   для мультиязычной аудитории. Брать в первую очередь.
2. **Защитно докупить** к нему: `segurotenerife.net`, `segurotenerife.io`,
   `seguro-tenerife.com` (дефис) — все свободны, чтобы их не перехватили и
   редиректить на основной.
3. **Ключевые домены под кампании/лендинги** (свободны): `segurovisatenerife.com`
   (виза), `residenciatenerife.com` (ВНЖ), `insurancetenerife.com` (для англоязычных).
   Не обязательны, но усиливают гео+интент-SEO под конкретные запросы.

`.es` для бренда занят (`segurotenerife.es`, `seguro-tenerife.es` — TAKEN). Это не
проблема: стратегия `.com` + hreflang покрывает Испанию не хуже (см. ниже).

---

## SEO/GEO-стратегия: почему `.com`, а не `.es`-only

- **ccTLD `.es`** даёт сильнейший гео-сигнал для Испании, НО он привязан к одной
  стране и аудитория ru/uk/en, ищущая из-за рубежа (перед переездом), воспринимает
  `.com` как нейтральный и доверенный. `.es` также сложнее в управлении и SEO ведётся
  отдельно. Для бренда он к тому же занят.
- **`.com` + правильная локализация** — практичный выбор для мультиязычного сайта:
  вся ссылочная масса/авторитет копится на одном домене, а гео-таргетинг Испании
  достигается через **hreflang** + локальные сигналы (испанский контент, адрес/телефон
  на Тенерифе, разметка LocalBusiness, регистрация в Google Search Console).
- **Ключевое слово в домене** сегодня даёт небольшой прямой вес в ранжировании, но
  заметно помогает **узнаваемости и CTR** в выдаче. `seguro` + `tenerife` —
  оптимальная пара: испанский корень «страховка» + гео-маркер острова.

### Архитектура локализации (рекомендация)
Один домен `.com`, языки в **подпапках** (консолидируют авторитет), с hreflang:
```
segurotenerife.com/es/   → hreflang="es-es"   (Испания, основной рынок)
segurotenerife.com/en/   → hreflang="en"      (англоязычные экспаты)
segurotenerife.com/ru/   → hreflang="ru"
segurotenerife.com/uk/   → hreflang="uk"
+ x-default → /es/ или /en/
```
> 75% внедрений hreflang содержат ошибки (нет обратных тегов, битые URL, неверные
> ISO-коды) — одна ошибка обнуляет весь кластер. Обязательны: самоссылающиеся теги,
> симметричные аннотации, валидные ISO-коды.

### Контент под интент (то, что реально ищут приезжие)
Подтверждённые запросы аудитории (под них делать страницы/статьи и slug-и):
- ES: «seguro médico para visado/residencia», «seguro NLV/visado nómada digital»,
  «seguro de salud sin copagos ni carencias», «seguro médico Tenerife».
- EN: «health insurance Spain visa/residency», «NLV insurance», «digital nomad visa
  health insurance Spain», «insurance Tenerife».
- RU/UK: «страховка для ВНЖ Испания», «медстраховка для визы цифрового кочевника»,
  «страховка Тенерифе».
Ключевые требования (есть в нашей базе ASISA): без copagos, без периодов ожидания,
репатриация, мгновенный сертификат — это и есть seo-«ядро» страниц под визу/ВНЖ.

---

## Таблица доступности (whois + DNS, июнь 2026)

### ✅ Свободны
| Домен | Комментарий |
|---|---|
| **segurotenerife.com** | ⭐ Бренд + seguro+tenerife + `.com`. ОСНОВНОЙ выбор. |
| seguro-tenerife.com | Дефис-вариант — защитно/редирект на основной. |
| segurotenerife.net | Защитный к бренду. |
| segurotenerife.io | Защитный (и «техно»-вариант). |
| segurovisatenerife.com | Интент «виза» + гео — под визовый лендинг/кампании. |
| residenciatenerife.com | Интент «ВНЖ/residencia» — под residency-контент. |
| insurancetenerife.com | Английский ключ для en-аудитории. |
| tenerifeinsure.com | Короткий en-вариант. |
| insuretenerife.com | en-вариант. |
| expatinsurancetenerife.com | Длинный, под точечные en-кампании (не приоритет). |
| mitenerifeseguro.com | «mi…» — брендовый испанский тон (запасной). |
| holatenerifeseguro.com | «hola…» — маркетинговый тон (запасной). |

### ❌ Заняты
`segurotenerife.es`, `seguro-tenerife.es`, `segurostenerife.com/.es`,
`tenerifeseguros.com/.es`, `tenerifeinsurance.com`, `segurocanarias.com`,
`seguroscanarias.com`, `canariasseguros.com`, `segurosexpat.com`,
`segurotenerife.app`, `segurotenerife.eu`.

> Проверено `whois` + `dig` (ни A-записи, ни регистрации у «свободных»). Перед
> покупкой финально подтвердить у регистратора — статусы могут меняться.

---

## План действий
1. **Зарегистрировать `segurotenerife.com`** (основной) + защитные `.net`, `.io`,
   `seguro-tenerife.com` → 301-редирект на основной.
2. (Опц.) Взять `segurovisatenerife.com` и `residenciatenerife.com` под визовые/ВНЖ
   лендинги или как 301 на соответствующие разделы основного домена.
3. Деплой по `docs/deploy.md`; в Search Console: добавить домен, hreflang, sitemap,
   указать гео-таргет Испания (для `.com` это делается настройками + сигналами).
4. Языки — подпапками `/es /en /ru /uk` с корректным hreflang (см. выше).
5. Под визу/ВНЖ — отдельные страницы с интент-ключами (требования консульств,
   сертификат, без copagos/carencias) на базе каталога ASISA.

## Источники
- [Hreflang for Spanish: ES vs LATAM 2026 — JJSEO](https://jjseo.co.uk/hreflang-spanish-es-latam-2026)
- [International SEO & GEO best practices 2026 — Elementor](https://elementor.com/blog/international-seo-geo-best-practices-strategy-in-year/)
- [International SEO for Spain — Mediseo](https://www.mediseo.es/blog/2026-11-international-seo-spain-norway)
- [International SEO 2026: Hreflang guide — DigitalApplied](https://www.digitalapplied.com/blog/international-seo-2026-hreflang-multilingual-guide)
- [Spanish health insurance for residency & visas — MovingToSpain](https://movingtospain.com/spanish-health-insurance-for-residency-and-visas/)
- [Digital nomad visa Spain health insurance](https://healthinsuranceforspanishvisas.com/digital-nomad-visa-health-insurance/)
