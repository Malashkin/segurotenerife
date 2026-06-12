/**
 * Молекула FieldRow (Atomic Design → molecules).
 *
 * Связка «подпись + поле + ошибка/подсказка» — переиспользуется в форме контактов
 * чат-флоу (.field в прототипе /Users/mike/Desktop/fun/index.html). Сама молекула
 * не знает о типе контрола: контрол (Input, select, группа мессенджеров)
 * передаётся через `children`.
 *
 * Доступность:
 *   - Генерирует/принимает `id`, связывает <label htmlFor> с полем и подсказку/
 *     ошибку через `aria-describedby` (передаётся детям как `descriptionId`).
 *   - Поэтому в качестве children удобно использовать render-функцию,
 *     получающую { id, describedBy, invalid }.
 */
import { useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Аргументы render-функции children — связывают контрол с label/описанием. */
export interface FieldRowRenderProps {
  /** id для контрола (совпадает с htmlFor у label). */
  id: string;
  /** id элемента описания для aria-describedby (или undefined, если описания нет). */
  describedBy: string | undefined;
  /** Поле в состоянии ошибки. */
  invalid: boolean;
}

export interface FieldRowProps {
  /** Текст подписи поля. */
  label: ReactNode;
  /** id контрола; если не задан — генерируется через useId. */
  htmlFor?: string;
  /** Подсказка под полем (показывается, когда нет ошибки). */
  hint?: ReactNode;
  /** Текст ошибки; если задан — поле считается невалидным. */
  error?: ReactNode;
  /** Пометить поле как обязательное (звёздочка + aria). */
  required?: boolean;
  /** Дополнительные классы обёртки. */
  className?: string;
  /**
   * Контрол поля. Либо обычный ReactNode, либо render-функция, получающая
   * { id, describedBy, invalid } для проброса в Input/select.
   */
  children: ReactNode | ((props: FieldRowRenderProps) => ReactNode);
}

/** Строка формы: подпись + контрол + подсказка/ошибка. */
export function FieldRow({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldRowProps) {
  // Стабильный авто-id, если явный не передан.
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const invalid = Boolean(error);

  // id для описания (ошибка приоритетнее подсказки) — для aria-describedby.
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-brand">
            *
          </span>
        )}
      </label>

      {typeof children === 'function' ? children({ id, describedBy, invalid }) : children}

      {/* Ошибка имеет приоритет над подсказкой. role=alert — для скринридеров. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
