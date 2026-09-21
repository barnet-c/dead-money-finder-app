import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, RefreshCw, Upload, Search } from 'lucide-react';
import { api } from '@/api/client';
import { calcNextDue } from '@/lib/utils';
import { Masthead, EmptyState } from '@/components/Editorial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import CustomerCard from '@/components/CustomerCard';
import BulkActionBar from '@/components/BulkActionBar';
import BulkUpdateIntervalModal from '@/components/BulkUpdateIntervalModal';
import ReminderModal from '@/components/ReminderModal';
import CustomerFormModal from '@/components/CustomerFormModal';

const CSV_COLUMNS = ['customer_name', 'email', 'phone', 'service_type', 'last_service_date', 'repeat_interval_days', 'notes'];

export default function Customers() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [remindQueue, setRemindQueue] = useState([]);
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);

  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: () => api.entities.BusinessSettings.list() });
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => api.entities.CustomerServiceRecord.list('next_due_date') });
  const settings = settingsQ.data?.[0] || null;
  const customers = customersQ.data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => [c.customer_name, c.email, c.phone, c.service_type].some((v) => (v || '').toLowerCase().includes(q)));
  }, [customers, search]);

  const selectedCustomers = useMemo(() => customers.filter((c) => selected.has(c.id)), [customers, selected]);
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected((s) => (s.size >= filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  const clear = () => setSelected(new Set());

  const del = useMutation({
    mutationFn: (c) => api.entities.CustomerServiceRecord.delete(c.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer removed'); },
    onError: (e) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: () => Promise.all(selectedCustomers.map((c) => api.entities.CustomerServiceRecord.update(c.id, { reminder_status: 'opted_out' }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success(`${selectedCustomers.length} archived`); clear(); },
    onError: (e) => toast.error(e.message),
  });

  const importCsv = useMutation({
    mutationFn: async (file) => {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('CSV needs a header row and at least one record');
      const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, headers.indexOf(c)]));
      if (idx.customer_name < 0 || idx.email < 0 || idx.service_type < 0 || idx.last_service_date < 0) {
        throw new Error('CSV must include customer_name, email, service_type and last_service_date columns');
      }
      const defaults = settings?.default_intervals || [];
      const items = rows.slice(1).filter((r) => r.some((v) => v.trim())).map((r) => {
        const get = (k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
        const service_type = get('service_type');
        const dflt = defaults.find((d) => d.service_type?.toLowerCase() === service_type.toLowerCase());
        const interval = Number(get('repeat_interval_days')) || dflt?.interval_days || 90;
        const last = normalizeDate(get('last_service_date'));
        return {
          customer_name: get('customer_name'),
          email: get('email'),
          phone: get('phone') || null,
          service_type,
          last_service_date: last,
          repeat_interval_days: interval,
          next_due_date: calcNextDue(last, interval),
          notes: get('notes') || null,
        };
      }).filter((i) => i.customer_name && i.email && i.service_type && i.last_service_date);
      if (!items.length) throw new Error('No valid rows found');
      await api.entities.CustomerServiceRecord.bulkCreate(items);
      return items.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success(`Imported ${n} customer${n === 1 ? '' : 's'}`); },
    onError: (e) => toast.error(e.message),
  });

  const selecting = selected.size > 0;
  const currentRemind = remindQueue[0] || null;
  const advanceQueue = () => setRemindQueue((q) => q.slice(1));

  return (
    <>
      <Masthead kicker="The Customers" meta={`${customers.length} record${customers.length === 1 ? '' : 's'}`} title="The" italic="Customers">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv.mutate(f); e.target.value = ''; }} />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}><Upload className="h-3.5 w-3.5" /> {importCsv.isPending ? 'Importing…' : 'Import CSV'}</Button>
        <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['customers'] })}><RefreshCw className={customersQ.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Refresh</Button>
        <Button onClick={() => { setEdit(null); setFormOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add customer</Button>
      </Masthead>

      <div className="mb-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-0 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone or service…" className="pl-7" />
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          CSV columns · {CSV_COLUMNS.join(' · ')}
        </p>
      </div>

      {customersQ.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={customers.length ? 'No one matches that search.' : 'The ledger is empty.'}
          line={customers.length ? 'Try a different name, email or service.' : 'Add a customer or import a CSV to begin.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c}
              selectable
              selected={selected.has(c.id)}
              onToggle={toggle}
              showDelete={!selecting}
              onDelete={(x) => { if (window.confirm(`Delete ${x.customer_name}? This cannot be undone.`)) del.mutate(x); }}
              onEdit={(x) => { setEdit(x); setFormOpen(true); }}
              onRemind={(x) => setRemindQueue([x])}
            />
          ))}
        </div>
      )}

      <BulkActionBar
        count={selected.size}
        total={filtered.length}
        onSelectAll={selectAll}
        onClear={clear}
        onSendReminders={() => { setRemindQueue(selectedCustomers.filter((c) => c.reminder_status !== 'opted_out')); clear(); }}
        onUpdateInterval={() => setIntervalOpen(true)}
        onArchive={() => { if (window.confirm(`Archive ${selected.size} customer(s)? They will stop receiving reminders.`)) archive.mutate(); }}
        busy={archive.isPending}
      />

      <ReminderModal
        open={!!currentRemind}
        onOpenChange={(o) => { if (!o) advanceQueue(); }}
        customer={currentRemind}
        settings={settings}
      />
      <CustomerFormModal open={formOpen} onOpenChange={setFormOpen} customer={edit} settings={settings} />
      <BulkUpdateIntervalModal open={intervalOpen} onOpenChange={setIntervalOpen} customers={selectedCustomers} onDone={clear} />
    </>
  );
}

/** Minimal RFC 4180 CSV parser (handles quoted fields, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normalizeDate(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); // dd/mm/yyyy
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
