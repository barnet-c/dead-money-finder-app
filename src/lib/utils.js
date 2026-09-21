import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** next_due_date = last_service_date + repeat_interval_days */
export function calcNextDue(lastServiceDate, intervalDays) {
  if (!lastServiceDate) return null;
  const d = typeof lastServiceDate === 'string' ? parseISO(lastServiceDate) : lastServiceDate;
  if (!isValid(d)) return null;
  return format(addDays(d, Number(intervalDays) || 0), 'yyyy-MM-dd');
}

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return differenceInCalendarDays(d, now);
}

/** <0 overdue, 0 today, ≤14 soon, >14 ok */
export function dueCategory(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return 'neutral';
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 14) return 'soon';
  return 'ok';
}

export function fmtDate(dateStr, pattern = 'd MMM yyyy') {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(d)) {
    const alt = new Date(dateStr);
    return isValid(alt) ? format(alt, pattern) : '—';
  }
  return format(d, pattern);
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isValid(d) ? format(d, 'd MMM yyyy · HH:mm') : '—';
}

export const todayLong = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
