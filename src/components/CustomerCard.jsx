import { Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { cn, fmtDate } from '@/lib/utils';
import DueBadge from './DueBadge';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';

const STATUS = {
  pending: { label: 'Pending', cls: 'text-muted-foreground' },
  sent: { label: 'Reminder sent', cls: 'text-slate-ink' },
  booked: { label: 'Booked', cls: 'text-olive' },
  opted_out: { label: 'Opted out', cls: 'text-muted-foreground/60' },
};

export default function CustomerCard({
  customer,
  onEdit,
  onRemind,
  onDelete,
  selectable = false,
  selected = false,
  onToggle,
  showDelete = false,
}) {
  const status = STATUS[customer.reminder_status] || STATUS.pending;

  return (
    <article
      className={cn(
        'group relative flex flex-col border border-border bg-card p-5 rounded-sm transition-colors',
        'hover:border-foreground/30',
        customer.booked_again && 'bg-olive/8 border-olive/20',
        selected && 'ring-1 ring-foreground border-foreground',
      )}
    >
      {selectable && (
        <div className="absolute left-4 top-4 z-10">
          <Checkbox checked={selected} onCheckedChange={() => onToggle?.(customer.id)} aria-label={`Select ${customer.customer_name}`} />
        </div>
      )}
      {showDelete && !selectable && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(customer)}
          className="absolute right-4 top-4 hidden group-hover:inline-flex text-muted-foreground hover:text-rust transition-colors"
          aria-label="Delete customer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className={cn('flex items-start justify-between gap-3', selectable && 'pl-7')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="truncate">{customer.service_type}</span>
            {customer.booked_again && <span className="text-olive">· rebooked</span>}
          </div>
          <h3 className="mt-1.5 font-serif text-2xl leading-tight truncate">{customer.customer_name}</h3>
        </div>
        <DueBadge date={customer.next_due_date} className="shrink-0 mt-1" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-border py-3 font-mono text-[11px]">
        <div>
          <dt className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Last</dt>
          <dd className="mt-1 tabular-nums">{fmtDate(customer.last_service_date, 'd MMM yy')}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Next due</dt>
          <dd className="mt-1 tabular-nums">{fmtDate(customer.next_due_date, 'd MMM yy')}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Every</dt>
          <dd className="mt-1 tabular-nums">{customer.repeat_interval_days}d</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{customer.email}</span></div>
        {customer.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{customer.phone}</div>}
        {customer.notes && <p className="pt-1 font-sans text-xs italic leading-relaxed text-muted-foreground line-clamp-2">{customer.notes}</p>}
      </div>

      <div className="mt-auto flex items-center justify-between pt-4">
        <span className={cn('font-mono text-[10px] uppercase tracking-[0.18em]', status.cls)}>{status.label}</span>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(customer)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
          {onRemind && customer.reminder_status !== 'opted_out' && (
            <Button variant="secondary" size="sm" onClick={() => onRemind(customer)}>
              Send reminder →
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
