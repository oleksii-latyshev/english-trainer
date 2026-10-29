const TRANSLATABLE_PATHS = new Set(['/conversation', '/memory', '/memory/review', '/summary']);

const MISTAKES_PATH = '/mistakes';

export function isTranslatablePath(pathname: string): boolean {
  return (
    TRANSLATABLE_PATHS.has(pathname) ||
    pathname === MISTAKES_PATH ||
    pathname.startsWith(`${MISTAKES_PATH}/`)
  );
}
