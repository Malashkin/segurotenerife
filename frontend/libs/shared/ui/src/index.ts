/**
 * Публичный API библиотеки shared/ui (FSD public API).
 *
 * Сюда реэкспортируются ТОЛЬКО те atoms / molecules / organisms, которые
 * предназначены для использования снаружи. Внутреннюю структуру папок
 * (atoms/molecules/organisms, lib/) потребители не импортируют напрямую —
 * только через `@shared/ui`.
 *
 * Как добавить новый компонент:
 *   1. Создать файл в src/atoms|molecules|organisms.
 *   2. Добавить строку реэкспорта ниже.
 *
 * Принцип развязки слоёв: shared/ui НЕ зависит от shared/i18n, роутинга и api.
 * Локализованные строки, ссылки и колбэки приходят в компоненты пропсами.
 */

// --- Утилиты ---
export { cn } from './lib/cn';

// --- Atoms ---
export { Button, buttonVariants, type ButtonProps } from './atoms/Button';
export { Reveal, type RevealProps } from './atoms/Reveal';
export { Input, type InputProps } from './atoms/Input';
export {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  cardVariants,
  type CardProps,
} from './atoms/Card';
export { Badge, badgeVariants, type BadgeProps } from './atoms/Badge';
export { Chip, type ChipProps } from './atoms/Chip';
export {
  Spinner,
  TypingDots,
  spinnerVariants,
  type SpinnerProps,
  type TypingDotsProps,
} from './atoms/Spinner';

// --- Molecules ---
export {
  FieldRow,
  type FieldRowProps,
  type FieldRowRenderProps,
} from './molecules/FieldRow';
export { OptionButton, type OptionButtonProps } from './molecules/OptionButton';
export { LangSwitcher, type LangSwitcherProps } from './molecules/LangSwitcher';

// --- Organisms ---
export { Brand, type BrandProps } from './organisms/Brand';
export { SectionHeader, type SectionHeaderProps } from './organisms/SectionHeader';
export { NavBar, type NavBarProps, type NavLink } from './organisms/NavBar';
export {
  Footer,
  type FooterProps,
  type FooterColumn,
} from './organisms/Footer';
