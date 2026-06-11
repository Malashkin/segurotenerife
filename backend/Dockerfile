# ── Стадия сборки ─────────────────────────────────────────
FROM rust:1.88 AS builder
WORKDIR /app

# Сначала только манифест — чтобы кэшировать слой зависимостей
COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release || true

# Теперь реальный код и миграции
COPY src ./src
COPY migrations ./migrations
RUN touch src/main.rs && cargo build --release

# ── Финальный минимальный образ ───────────────────────────
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/seguro-backend /app/seguro-backend
COPY --from=builder /app/migrations /app/migrations
ENV PORT=8080
EXPOSE 8080
CMD ["/app/seguro-backend"]
