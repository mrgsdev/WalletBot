import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tg } from '../lib/telegram';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Высокий лист занимает почти весь экран (например, сетка категорий). */
  tall?: boolean;
}

/**
 * Сколько листов открыто прямо сейчас.
 *
 * Каждый лист блокировал прокрутку и восстанавливал прежнее значение при
 * закрытии. Если листы открывались вложенно, нижний восстанавливал уже
 * изменённое верхним значение, и прокрутка залипала навсегда — интерфейс
 * выглядел «зависшим». Считаем открытые листы и снимаем блокировку,
 * только когда закрылся последний.
 */
let openSheets = 0;

function lockScroll() {
  openSheets += 1;
  if (openSheets === 1) document.body.style.overflow = 'hidden';
}

function unlockScroll() {
  openSheets = Math.max(openSheets - 1, 0);
  if (openSheets === 0) document.body.style.overflow = '';
}

/**
 * Аварийный сброс: если счётчик разошёлся с реальностью, прокрутка
 * осталась бы заблокированной навсегда. Проверяем это при каждом закрытии.
 */
function assertScrollSane() {
  if (openSheets === 0 && document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
}

/** Модальный лист, выезжающий снизу, — базовый паттерн навигации приложения. */
export function Sheet({ open, onClose, title, children, tall = false }: Props) {
  useEffect(() => {
    if (!open) {
      assertScrollSane();
      return;
    }
    lockScroll();
    return () => {
      unlockScroll();
      assertScrollSane();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return tg.pushBackHandler(onClose);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

          <motion.div
            className={`relative rounded-t-4xl bg-surface shadow-sheet ${tall ? 'max-h-[92%]' : 'max-h-[80%]'} flex flex-col`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose();
            }}
          >
            <div className="flex justify-center pt-3">
              <div className="h-1 w-10 rounded-full bg-muted/40" />
            </div>

            {title && (
              <div className="px-5 pb-2 pt-3 text-center text-[17px] font-semibold">{title}</div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+var(--safe-bottom))]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
