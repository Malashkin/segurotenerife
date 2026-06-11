//! Пул соединений к PostgreSQL.

use std::time::Duration;

use sqlx::postgres::PgPoolOptions;

/// Создаёт пул соединений. Ограничиваем размер пула и таймаут получения соединения,
/// чтобы не исчерпать соединения БД под нагрузкой (см. backend.md → connection pool).
pub async fn connect(database_url: &str) -> anyhow::Result<sqlx::PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;
    Ok(pool)
}
