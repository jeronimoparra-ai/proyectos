interface CalendarInterval {
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  start_day?: string | null;
  end_day?: string | null;
}
export function eventOccursOnDay(event: CalendarInterval, day: Date): boolean {
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  if (event.all_day) {
    const start = event.start_day ?? event.start_date.slice(0, 10);
    const end = event.end_day ?? event.end_date?.slice(0, 10);
    return start <= key && (end && end > start ? key < end : key === start);
  }
  const start = new Date(event.start_date);
  const end = new Date(event.end_date ?? event.start_date);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return start < dayEnd && (end > dayStart || start.getTime() === dayStart.getTime());
}
