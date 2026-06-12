/**
 * Публичный API фичи chat (внутренний — реэкспортируется в features/src/index.ts).
 *
 * Наружу отдаём только готовый виджет <ChatWidget/>. Внутренние модели
 * (chatDict / options / handoff / useChat*) — детали реализации фичи и не
 * экспортируются за пределы слоя features.
 */
export { ChatWidget } from './ui/ChatWidget';
