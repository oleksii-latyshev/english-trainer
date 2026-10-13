function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(count: number, minutes: number): { date: string; minutes: number } {
  const now = new Date();
  return {
    date: dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - count)),
    minutes,
  };
}

export const spokenToday = daysAgo(0, 12);
