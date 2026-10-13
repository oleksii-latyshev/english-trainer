const NOON_HOUR = 12;
const EVENING_HOUR = 18;

export function greeting(hour: number): string {
  if (hour < NOON_HOUR) return 'Good morning';
  if (hour < EVENING_HOUR) return 'Good afternoon';
  return 'Good evening';
}
