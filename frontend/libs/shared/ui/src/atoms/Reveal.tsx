/**
 * Reveal — мягкое появление блока при попадании в зону видимости.
 *
 * Через IntersectionObserver: пока блок вне экрана — он слегка смещён вниз и
 * прозрачен; при входе в видимую область плавно «всплывает». Это убирает
 * «рывки» при прокрутке между секциями.
 *
 * Доступность: начальное скрытие и переход — ТОЛЬКО под `motion-safe`. При
 * prefers-reduced-motion блок всегда видим и без анимаций.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface RevealProps {
  children: ReactNode;
  /** Доп. классы внешнего контейнера. */
  className?: string;
}

export function Reveal({ children, className }: RevealProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        shown ? 'opacity-100 motion-safe:translate-y-0' : 'motion-safe:translate-y-5 motion-safe:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
