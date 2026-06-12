/**
 * Утилита объединения CSS-классов в стиле shadcn/ui.
 *
 * clsx — собирает классы из строк/объектов/массивов с учётом условий.
 * tailwind-merge — корректно «схлопывает» конфликтующие Tailwind-классы
 * (например `px-2 px-4` -> `px-4`), чтобы переопределение классов снаружи
 * через проп `className` работало предсказуемо.
 *
 * Это базовый кирпич всех atoms/molecules — держим его в shared/ui/lib.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Объединяет произвольный набор классов в одну строку.
 * @param inputs - классы (строки, условные объекты, массивы)
 * @returns итоговая строка классов с разрешёнными конфликтами Tailwind
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
