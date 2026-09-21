import { X, Send, Timer, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BulkActionBar({ count, total, onSelectAll, onClear, onSendReminders, onUpdateInterval, onArchive, busy }) {
  const allSelected = count >= total && total > 0;
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 md:left-[calc(50%+8rem)]"
        >
          <div className="flex items-center gap-1 rounded-sm bg-foreground px-2 py-1.5 text-background shadow-xl">
            <span className="px-3 font-mono text-[11px] uppercase tracking-wider tabular-nums">{count} selected</span>
            <span className="h-4 w-px bg-background/20" />
            <BarButton onClick={onSelectAll}>{allSelected ? 'Deselect all' : 'Select all'}</BarButton>
            <span className="h-4 w-px bg-background/20" />
            <BarButton onClick={onSendReminders} disabled={busy}><Send className="h-3 w-3" /> Send reminders</BarButton>
            <BarButton onClick={onUpdateInterval} disabled={busy}><Timer className="h-3 w-3" /> Update interval</BarButton>
            <BarButton onClick={onArchive} disabled={busy} className="text-[hsl(12_65%_70%)] hover:text-[hsl(12_65%_80%)]"><Archive className="h-3 w-3" /> Archive</BarButton>
            <span className="h-4 w-px bg-background/20" />
            <button type="button" onClick={onClear} className="p-2 opacity-70 hover:opacity-100" aria-label="Clear selection">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BarButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider opacity-85 hover:opacity-100 disabled:opacity-40 transition-opacity ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
