export type Locale = { code: string; label: string };

export const locales: Locale[] = (import.meta.env.I18N_LOCALES ?? 'en:English')
  .split(',')
  .map((p: string) => {
    const [code, ...rest] = p.split(':');
    return { code: code.trim(), label: rest.join(':').trim() || code.trim() };
  });

export const defaultLocale = (import.meta.env.DEFAULT_LOCALE ?? 'en').trim();

export function isSupported(code?: string) {
  return !!locales.find(l => l.code === code);
}
