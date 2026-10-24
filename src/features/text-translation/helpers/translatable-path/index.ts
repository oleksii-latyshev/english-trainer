const TRANSLATABLE_PATHS = new Set(['/conversation', '/memory', '/memory/review', '/summary']);

export function isTranslatablePath(pathname: string): boolean {
  return TRANSLATABLE_PATHS.has(pathname);
}
