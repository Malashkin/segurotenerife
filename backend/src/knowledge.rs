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
        let mut scored: Vec<(i64, usize)> = self
            .docs
            .iter()
            .enumerate()
            .map(|(i, doc)| (self.score(doc, &self.haystacks[i], &tokens, intent), i))
            .collect();

        scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));

        let any_positive = scored.first().map(|(s, _)| *s > 0).unwrap_or(false);
        if !any_positive {
            // Ни интента, ни лексики — дефолтная подборка (медицина для приезжих).
            return self.fallback_docs(k);
        }

        scored
            .into_iter()
            .filter(|(s, _)| *s > 0)
            .take(k)
            .map(|(_, i)| &self.docs[i])
            .collect()
    }

    fn score(&self, doc: &ServiceDoc, haystack: &str, tokens: &BTreeSet<String>, intent: Option<&str>) -> i64 {
        let mut score = 0i64;
        if let Some(intent) = intent {
            if doc.intents.iter().any(|i| i == intent) {
                score += 100;
            }
        }
        for tok in tokens {
            if doc.keywords.iter().any(|kw| {
                let kw = kw.to_lowercase();
                kw == *tok || kw.contains(tok.as_str())
            }) {
                score += 10;
            } else if haystack.contains(tok.as_str()) {
                score += 2;
            }
        }
        score
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

/// Пост-гейт бренда: вырезает названия страховщика из ответа модели (политика
/// нейтрального бренда). Возвращает (очищенный_текст, было_ли_совпадение).
/// Корпус бренд-нейтрален, так что срабатывать должно крайне редко — это
/// страховка от «знаний» самой модели.
pub fn strip_brand(text: &str) -> (String, bool) {
    const BRANDS: [&str; 2] = ["asisa", "ocaso"];
    let mut leaked = false;
    let mut out = text.to_string();
    for brand in BRANDS {
        loop {
            let lower = out.to_lowercase();
            let Some(pos) = lower.find(brand) else { break };
            leaked = true;
            out.replace_range(pos..pos + brand.len(), "");
        }
    }
    if leaked {
        // Подчищаем двойные пробелы/пробелы перед пунктуацией после вырезания.
        let collapsed = out.split_whitespace().collect::<Vec<_>>().join(" ");
        out = collapsed.replace(" ,", ",").replace(" .", ".").replace(" :", ":");
    }
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
}
