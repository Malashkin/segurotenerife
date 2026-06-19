# ── Стадия сборки ─────────────────────────────────────────
# ВАЖНО: контекст сборки — КОРЕНЬ репозитория (нужен knowledge-base вне backend/).
# В Railway: Root Directory = репозиторий, dockerfilePath = backend/Dockerfile.
FROM rust:1.88 AS builder
WORKDIR /app

# Сначала только манифест + lock — кэшируем слой зависимостей и собираем ровно
# зафиксированные версии (воспроизводимая сборка).
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release --locked || true

# Реальный код и миграции.
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN touch src/main.rs && cargo build --release --locked

# ── Финальный минимальный образ ───────────────────────────
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/seguro-backend /app/seguro-backend
COPY --from=builder /app/migrations /app/migrations
# Бренд-нейтральный корпус RAG-агента — копируем в образ, иначе /api/chat → 503.
COPY knowledge-base /app/knowledge-base
ENV KNOWLEDGE_PATH=/app/knowledge-base/asisa/services.json
ENV PORT=8080
EXPOSE 8080
CMD ["/app/seguro-backend"]
