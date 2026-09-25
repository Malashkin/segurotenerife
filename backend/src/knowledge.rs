//! База знаний RAG-агента подбора страховок.
//!
//! Загружает БРЕНД-НЕЙТРАЛЬНЫЙ корпус `knowledge-base/asisa/services.json`
//! (никаких названий страховщика/брендовых продуктов — политика нейтрального
//! бренда) и предоставляет лексический ретривал по интенту чата и тексту запроса.
//!
//! Почему лексика, а не эмбеддинги: корпус крошечный (десятки сервис-доков),
//! интент уже известен из гайдового чата, а мультиязычные `keywords` дают
//! кросс-язычный матч (ru/uk/en-запрос → es-док) без внешнего провайдера.
//!
//! Заземление (уроки бенчмарков агентной коммерции): в ответы попадает только
//! этот корпус; имена продуктов и бренд не хранятся → модель не может их
//! процитировать. Доп. страховка — `strip_brand()` как пост-гейт ответа.

use std::collections::BTreeSet;

use serde::Deserialize;

/// Один сервис-док корпуса (бренд-нейтральный).
#[derive(Debug, Clone, Deserialize)]
pub struct ServiceDoc {
    pub id: String,
    #[serde(default)]
    pub intents: Vec<String>,
    pub title_es: String,
    #[serde(default)]
    pub audience_es: Vec<String>,
    #[serde(default)]
    pub covers_es: Vec<String>,
    #[serde(default)]
    pub conditions_es: Vec<String>,
    #[serde(default)]
    pub limits_es: Vec<String>,
    #[serde(default)]
    pub expat_note_es: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ServicesFile {
    services: Vec<ServiceDoc>,
}

/// Корпус знаний + предрасчитанный «стог» для лексического поиска.
#[derive(Debug, Clone)]
pub struct KnowledgeBase {
    docs: Vec<ServiceDoc>,
    /// Для каждого дока — лоуэркейс-набор полей для лексического матча.
    haystacks: Vec<String>,
}

/// Слова длиной меньше этого в скоринге не учитываем (шум: «и», «по», «de»).
const MIN_TOKEN_LEN: usize = 3;

/// Результат скоринга одного дока.
///
/// `strong` отделяет осмысленное совпадение (интент или курированный `keyword`)
/// от случайного вхождения слова в общий «стог». Без этого различия выдача не
/// отличает «нашли по делу» от «слово встретилось в описании».
#[derive(Clone, Copy, Debug)]
struct Hit {
    score: i64,
    strong: bool,
}

impl KnowledgeBase {
    /// Грузит и парсит корпус из JSON-файла.
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let raw = std::fs::read_to_string(path)?;
        let parsed: ServicesFile = serde_json::from_str(&raw)?;
        Ok(Self::from_docs(parsed.services))
    }

    fn from_docs(docs: Vec<ServiceDoc>) -> Self {
        let haystacks = docs
            .iter()
            .map(|d| {
                let mut parts = vec![d.title_es.clone()];
                parts.extend(d.keywords.iter().cloned());
                parts.extend(d.audience_es.iter().cloned());
                parts.extend(d.covers_es.iter().cloned());
                parts.join(" ").to_lowercase()
            })
            .collect();
        Self { docs, haystacks }
    }

    pub fn len(&self) -> usize {
        self.docs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.docs.is_empty()
    }

    /// Компактный «индекс меню» всех сервисов для кэшируемого системного блока:
    /// модель всегда видит полный список доступных типов покрытия (без бренда).
    pub fn index_block(&self) -> String {
        self.docs
            .iter()
            .map(|d| format!("- [{}] {} (интенты: {})", d.id, d.title_es, d.intents.join(",")))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Ранжирует доки под запрос и (опц.) интент чата, возвращает top-k.
    ///
    /// Скоринг (детерминированный): интент-матч даёт сильный буст; совпадение
    /// токена запроса с курированным `keyword` — средний; вхождение в общий
    /// «стог» — слабый. Если совпадений нет вовсе — отдаём интент-доки или
    /// общий дефолт, чтобы агент всегда имел заземление.
    pub fn retrieve(&self, query: &str, intent: Option<&str>, k: usize) -> Vec<&ServiceDoc> {
        let tokens = tokenize(query);
        let mut scored: Vec<(Hit, usize)> = self
            .docs
            .iter()
            .enumerate()
            .map(|(i, doc)| (self.score(doc, &self.haystacks[i], &tokens, intent), i))
            .collect();

        scored.sort_by(|a, b| b.0.score.cmp(&a.0.score).then(a.1.cmp(&b.1)));

        // Фолбэк решается по СИЛЬНЫМ совпадениям (интент или курированный
        // keyword), а не по «счёт больше нуля». Разница не косметическая: слабое
        // вхождение в общий «стог» даёт +2, и нескольких таких хватало, чтобы
        // счёт стал положительным. Тогда фолбэк не срабатывал, и вместо
        // осмысленного дефолта выдача уходила в шум — на живом запросе
        // «long term residence» поднимались `salud-internacional` и `viaje`,
        // хотя правильный `salud-residencia` стоит первым в PRIORITY.
        let any_strong = scored.first().map(|(h, _)| h.strong).unwrap_or(false);
        if !any_strong {
            return self.fallback_docs(k);
        }

        scored
            .into_iter()
            .filter(|(h, _)| h.strong)
            .take(k)
            .map(|(_, i)| &self.docs[i])
            .collect()
    }

    fn score(&self, doc: &ServiceDoc, haystack: &str, tokens: &BTreeSet<String>, intent: Option<&str>) -> Hit {
        let mut hit = Hit { score: 0, strong: false };
        if let Some(intent) = intent {
            if doc.intents.iter().any(|i| i == intent) {
                hit.score += 100;
                hit.strong = true;
            }
        }
        for tok in tokens {
            if doc.keywords.iter().any(|kw| {
                let kw = kw.to_lowercase();
                kw == *tok || kw.contains(tok.as_str())
            }) {
                hit.score += 10;
                hit.strong = true;
            } else if haystack.contains(tok.as_str()) {
                hit.score += 2;
            }
        }
        hit
    }

    /// Дефолт, когда запрос ничего не зацепил: самые частые для аудитории доки.
    fn fallback_docs(&self, k: usize) -> Vec<&ServiceDoc> {
        const PRIORITY: [&str; 3] = ["salud-residencia", "salud-completa", "viaje"];
        let mut out: Vec<&ServiceDoc> = Vec::new();
        for id in PRIORITY {
            if let Some(d) = self.docs.iter().find(|d| d.id == id) {
                out.push(d);
            }
        }
        for d in &self.docs {
            if out.len() >= k {
                break;
            }
            if !out.iter().any(|x| x.id == d.id) {
                out.push(d);
            }
        }
        out.truncate(k);
        out
    }

    /// Рендер ретривнутых доков в текстовый блок для промпта (es-факты).
    pub fn render(docs: &[&ServiceDoc]) -> String {
        docs.iter()
            .map(|d| {
                let mut s = format!("### {} [{}]\n", d.title_es, d.id);
                let push = |s: &mut String, label: &str, items: &[String]| {
                    if !items.is_empty() {
                        s.push_str(&format!("{label}: {}\n", items.join("; ")));
                    }
                };
                push(&mut s, "Para quién", &d.audience_es);
                push(&mut s, "Cubre", &d.covers_es);
                push(&mut s, "Condiciones", &d.conditions_es);
                push(&mut s, "Límites", &d.limits_es);
                if let Some(note) = &d.expat_note_es {
                    s.push_str(&format!("Nota para extranjeros: {note}\n"));
                }
                s
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Токенизация запроса: лоуэркейс + разбиение по не-буквенно-цифровым,
/// отбрасываем короткие токены. Юникод-дружелюбно (кириллица сохраняется).
fn tokenize(query: &str) -> BTreeSet<String> {
    query
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.chars().count() >= MIN_TOKEN_LEN)
        .map(|t| t.to_string())
        .collect()
}

/// Известные бренды страховщиков (нижний регистр, ASCII), которые НЕЛЬЗЯ называть
/// (политика «никакой бренд»). Список — страховка от «знаний» самой модели;
/// первичная защита — бренд-нейтральный корпус + правило в системном промпте
/// (запрещает называть ЛЮБУЮ компанию). Здесь — самые вероятные на рынке Испании.
const INSURER_BRANDS: [&str; 12] = [
    "asisa", "ocaso", "sanitas", "adeslas", "mapfre", "dkv", "cigna", "caser",
    "aegon", "fiatc", "generali", "allianz",
];

/// Пост-гейт бренда: вырезает названия страховщиков из ответа модели.
/// Матч — по ГРАНИЦАМ слова (case-insensitive), чтобы не задеть обычные слова
/// (напр. «caser» внутри исп. «casero» не трогаем). Возвращает
/// (очищенный_текст, было_ли_совпадение).
pub fn strip_brand(text: &str) -> (String, bool) {
    let orig: Vec<char> = text.chars().collect();
    // Лоуэркейс-проекция 1:1 по символам (бренды ASCII → одного char достаточно).
    let lc: Vec<char> = orig
        .iter()
        .map(|c| c.to_lowercase().next().unwrap_or(*c))
        .collect();
    let n = orig.len();
    let mut keep = vec![true; n];
    let mut leaked = false;

    for brand in INSURER_BRANDS {
        let b: Vec<char> = brand.chars().collect();
        let bl = b.len();
        let mut i = 0;
        while i + bl <= n {
            let matches = lc[i..i + bl] == b[..];
            let left_ok = i == 0 || !orig[i - 1].is_alphanumeric();
            let right_ok = i + bl == n || !orig[i + bl].is_alphanumeric();
            if matches && left_ok && right_ok {
                leaked = true;
                for k in keep.iter_mut().take(i + bl).skip(i) {
                    *k = false;
                }
                i += bl;
            } else {
                i += 1;
            }
        }
    }

    if !leaked {
        return (text.to_string(), false);
    }
    let out: String = orig.iter().zip(keep).filter(|(_, k)| *k).map(|(c, _)| *c).collect();
    // Подчищаем двойные пробелы/пробелы перед пунктуацией после вырезания.
    let out = out.split_whitespace().collect::<Vec<_>>().join(" ");
    let out = out.replace(" ,", ",").replace(" .", ".").replace(" :", ":");
    (out, leaked)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kb() -> KnowledgeBase {
        KnowledgeBase::from_docs(vec![
            ServiceDoc {
                id: "salud-residencia".into(),
                intents: vec!["med".into(), "student".into()],
                title_es: "Seguro médico para residencia".into(),
                audience_es: vec!["Extranjeros con visado".into()],
                covers_es: vec!["Hospitalización".into()],
                conditions_es: vec!["Sin copagos".into()],
                limits_es: vec![],
                expat_note_es: Some("Para papeles de residencia".into()),
                keywords: vec!["виза".into(), "внж".into(), "residencia".into(), "visa".into()],
            },
            ServiceDoc {
                id: "dental".into(),
                intents: vec!["dental".into()],
                title_es: "Seguro dental".into(),
                audience_es: vec![],
                covers_es: vec!["Limpiezas".into()],
                conditions_es: vec![],
                limits_es: vec![],
                expat_note_es: None,
                keywords: vec!["стоматология".into(), "зубы".into(), "dental".into()],
            },
            ServiceDoc {
                id: "viaje".into(),
                intents: vec!["travel".into()],
                title_es: "Seguro de viaje".into(),
                audience_es: vec![],
                covers_es: vec![],
                conditions_es: vec![],
                limits_es: vec![],
                expat_note_es: None,
                keywords: vec!["путешествие".into(), "viaje".into(), "travel".into()],
            },
        ])
    }

    #[test]
    fn intent_boosts_matching_doc_first() {
        let kb = kb();
        let res = kb.retrieve("сколько стоит", Some("dental"), 2);
        assert_eq!(res[0].id, "dental");
    }

    #[test]
    fn cross_language_keyword_match() {
        // Русский запрос находит испанский док через keywords.
        let kb = kb();
        let res = kb.retrieve("нужна страховка для внж и визы", None, 2);
        assert_eq!(res[0].id, "salud-residencia");
    }

    #[test]
    fn english_keyword_match() {
        let kb = kb();
        let res = kb.retrieve("dental cleaning for my teeth", None, 1);
        assert_eq!(res[0].id, "dental");
    }

    #[test]
    fn no_match_returns_fallback_not_empty() {
        let kb = kb();
        let res = kb.retrieve("xyzzy qwerty", None, 3);
        assert!(!res.is_empty());
        assert_eq!(res[0].id, "salud-residencia"); // приоритетный дефолт
    }

    #[test]
    fn strip_brand_removes_and_flags() {
        let (out, leaked) = strip_brand("Рекомендую полис ASISA Completa для вас.");
        assert!(leaked);
        assert!(!out.to_lowercase().contains("asisa"));
        assert!(out.contains("Completa")); // вырезаем только бренд-слово
    }

    #[test]
    fn strip_brand_noop_when_clean() {
        let (out, leaked) = strip_brand("Подойдёт полис с покрытием госпитализации.");
        assert!(!leaked);
        assert_eq!(out, "Подойдёт полис с покрытием госпитализации.");
    }

    #[test]
    fn index_block_lists_all() {
        let kb = kb();
        let idx = kb.index_block();
        assert!(idx.contains("salud-residencia"));
        assert!(idx.contains("dental"));
        assert!(idx.contains("viaje"));
    }

    #[test]
    fn intent_outranks_lexical_match() {
        // Спецификация: интент чата авторитетнее лексики. Запрос лексически
        // совпадает с viaje, но интент=dental → dental должен быть первым.
        let kb = kb();
        let res = kb.retrieve("хочу страховку на viaje путешествие", Some("dental"), 1);
        assert_eq!(res[0].id, "dental");
    }

    #[test]
    fn intent_only_query_returns_intent_docs() {
        // Пустой по словам запрос + интент → возвращаем доки этого интента.
        let kb = kb();
        let res = kb.retrieve("?", Some("travel"), 2);
        assert_eq!(res[0].id, "viaje");
    }

    #[test]
    fn retrieve_respects_top_k() {
        // Несколько совпадений, но k=1 → ровно один док.
        let kb = kb();
        let res = kb.retrieve("viaje dental", None, 1);
        assert_eq!(res.len(), 1);
    }

    #[test]
    fn render_includes_grounding_facts() {
        // В промпт должны попадать сами факты покрытия (заземление), а не только id.
        let kb = kb();
        let docs = kb.retrieve("стоматология", Some("dental"), 1);
        let rendered = KnowledgeBase::render(&docs);
        assert!(rendered.contains("Cubre"));
        assert!(rendered.contains("Limpiezas"));
    }

    #[test]
    fn fallback_returns_priority_order_and_dedup() {
        // Запрос без совпадений → детерминированная подборка: приоритетные доки
        // первыми, без дублей, ровно k. Пинит логику fallback и ветку «нет
        // совпадений» (иначе вернулась бы пустота).
        let kb = kb();
        let res = kb.retrieve("zzz qqq xxx", None, 3);
        let ids: Vec<&str> = res.iter().map(|d| d.id.as_str()).collect();
        assert_eq!(ids, vec!["salud-residencia", "viaje", "dental"]);
    }

    #[test]
    fn len_and_empty_report_corpus() {
        let kb = kb();
        assert_eq!(kb.len(), 3);
        assert!(!kb.is_empty());
        assert!(KnowledgeBase::from_docs(vec![]).is_empty());
    }

    #[test]
    fn strip_brand_case_insensitive_and_multiple() {
        let (out, leaked) = strip_brand("ASISA, потом Asisa и ещё asisa, и Ocaso тоже.");
        assert!(leaked);
        let low = out.to_lowercase();
        assert!(!low.contains("asisa"));
        assert!(!low.contains("ocaso"));
    }

    #[test]
    fn strip_brand_covers_other_insurers() {
        // Политика «никакой бренд»: не только ASISA, но и конкуренты.
        for brand in ["Sanitas", "Mapfre", "DKV", "Adeslas", "Allianz"] {
            let (out, leaked) = strip_brand(&format!("Рекомендую {brand} для вас."));
            assert!(leaked, "{brand} должен быть вырезан");
            assert!(!out.to_lowercase().contains(&brand.to_lowercase()));
        }
    }

    #[test]
    fn strip_brand_does_not_touch_word_fragments() {
        // Границы слова: бренд внутри обычного слова НЕ трогаем.
        // 'caser' внутри исп. 'casero', 'generali' внутри 'generalidades'.
        let (out, leaked) = strip_brand("El casero firmó las generalidades del contrato.");
        assert!(!leaked);
        assert_eq!(out, "El casero firmó las generalidades del contrato.");
    }

    // ── Реальный корпус ──────────────────────────────────────────────────────
    // Эти проверки идут по боевому `knowledge-base/asisa/services.json`, а не по
    // игрушечному kb() выше. Причина: промах, который они ловят, был именно в
    // данных — в курированных `keywords` не хватало английских формулировок,
    // и на игрушечном корпусе он не воспроизводится.

    fn real_kb() -> KnowledgeBase {
        KnowledgeBase::load("../knowledge-base/asisa/services.json")
            .expect("боевой корпус должен читаться")
    }

    /// Запросы из живых сессий 2026-09-08: человек искал полис под ВНЖ, а
    /// ретривал поднимал `salud-estudiantes` + `mascotas` и `salud-internacional`
    /// + `viaje`. Тема лида бралась с этого промаха.
    #[test]
    fn english_residency_queries_retrieve_residencia_doc() {
        let kb = real_kb();
        for query in [
            "long term residence",
            "private medical insurance for residency",
            "residence permit insurance",
            "resident visa health cover",
        ] {
            let got = kb.retrieve(query, None, 2);
            assert_eq!(
                got.first().map(|d| d.id.as_str()),
                Some("salud-residencia"),
                "запрос {query:?} должен поднимать salud-residencia, а поднял {:?}",
                got.iter().map(|d| d.id.as_str()).collect::<Vec<_>>()
            );
        }
    }

    /// Слабые совпадения по общему «стогу» (+2) не должны вытеснять фолбэк:
    /// именно они делали счёт положительным и уводили выдачу в шум.
    #[test]
    fn weak_haystack_hits_do_not_beat_fallback() {
        let kb = real_kb();
        // Ни одного курированного keyword — только общие слова, которые
        // встречаются в описаниях доков.
        let got = kb.retrieve("hola buenos dias como estan ustedes", None, 3);
        assert_eq!(
            got.first().map(|d| d.id.as_str()),
            Some("salud-residencia"),
            "без keyword-совпадений должен отдаваться фолбэк, а пришло {:?}",
            got.iter().map(|d| d.id.as_str()).collect::<Vec<_>>()
        );
    }

    /// Английский посетитель должен попадать в свой док НАПРЯМУЮ, а не через
    /// фолбэк. Фолбэк спасает только там, где его приоритет случайно совпал с
    /// нужным доком; для всего остального он молча выдаёт не то.
    #[test]
    fn english_queries_route_to_their_own_doc() {
        let kb = real_kb();
        for (query, expected) in [
            ("long term residence", "salud-residencia"),
            ("residence permit insurance", "salud-residencia"),
            ("hospitalization cover", "hospitalizacion"),
            ("surgery and inpatient care", "hospitalizacion"),
            ("braces for my teeth", "dental"),
            ("travel luggage cover", "viaje"),
            ("mortgage life insurance", "vida"),
            ("maternity and pregnancy", "salud-completa"),
            ("outpatient budget plan", "salud-ambulatoria"),
            ("reimbursement refund private clinic", "salud-reembolso"),
            ("funeral repatriation", "decesos"),
            ("dog liability vet", "mascotas"),
        ] {
            let got = kb.retrieve(query, None, 3);
            assert_eq!(
                got.first().map(|d| d.id.as_str()),
                Some(expected),
                "запрос {query:?} должен поднимать {expected}, а поднял {:?}",
                got.iter().map(|d| d.id.as_str()).collect::<Vec<_>>()
            );
        }
    }
}
