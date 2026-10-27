const NOON_HOUR = 12;
const EVENING_HOUR = 18;

function salutation(hour: number): string {
  if (hour < NOON_HOUR) return 'Good morning';
  if (hour < EVENING_HOUR) return 'Good afternoon';
  return 'Good evening';
}

export function greeting(hour: number, name: string = ''): string {
  const trimmed = name.trim();
  return trimmed ? `${salutation(hour)}, ${trimmed}` : salutation(hour);
}
