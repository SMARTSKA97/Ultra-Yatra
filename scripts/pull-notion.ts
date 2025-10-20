#!/usr/bin/env tsx
import 'dotenv/config';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { notion, NOTION_DB_ID } from './utils/notion';
import { pageToMarkdown } from './utils/md';
import { slugify } from './utils/slugify';
import { download, localAssetPath, publicAssetUrl, basename } from './utils/download';

const OUT_DIR = 'src/content/posts';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

/** ---------- helpers ---------- */
function extractText(rich: any[] | undefined) {
  return (rich ?? []).map((t: any) => t?.plain_text ?? '').join('');
}
function getPropAny(props: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (props?.[k]) return props[k];
    const alt =
      Object.keys(props || {}).find((p) => p.toLowerCase() === k.toLowerCase());
    if (alt) return props[alt];
  }
  return undefined;
}
function getStatusName(props: Record<string, any>): string {
  const prop =
    props?.Status ?? props?.status ?? props?.State ?? props?.state ?? null;
  if (!prop) return '';
  if (prop.status?.name) return String(prop.status.name);
  if (prop.select?.name) return String(prop.select.name);
  return '';
}
function isPublishedStatus(name: unknown) {
  const s = String(name || '').trim().toLowerCase();
  return s === 'published' || s.startsWith('published') || s === 'live' || s === 'public';
}
function sanitizeOneLine(s?: string) {
  return (s || '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
}
function rewriteImageLinks(md: string) {
  if (!md) return '';
  return md.replace(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g, (m, url: string) => {
    const name = basename(new URL(url).pathname);
    return m.replace(url, `/notion-assets/${name}`);
  });
}
function extractYouTubeId(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return id;
      const parts = u.pathname.split('/').filter(Boolean);
      const maybe = parts.pop();
      if (maybe && maybe.length === 11) return maybe;
    }
  } catch {}
  return null;
}
function fmObj(input: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

/** ---------- main ---------- */
async function main() {
  // Try server-side filter first (Status-type). Fallback to Select-type if needed.
  let q: any;
  try {
    q = await notion.databases.query({
      database_id: NOTION_DB_ID,
      filter: { property: 'Status', status: { equals: 'Published' } }
    } as any);
  } catch {
    q = await notion.databases.query({
      database_id: NOTION_DB_ID,
      filter: { property: 'Status', select: { equals: 'Published' } }
    } as any);
  }

  // Sort newest first (PublishedAt fallback to last_edited_time)
  (q.results as any[]).sort((a, b) => {
    const pa = a.properties?.PublishedAt?.date?.start ?? a.last_edited_time;
    const pb = b.properties?.PublishedAt?.date?.start ?? b.last_edited_time;
    return new Date(pb).getTime() - new Date(pa).getTime();
  });

  const writtenFiles: string[] = [];

  for (const page of q.results as any[]) {
    const props = page.properties ?? {};

    // Double-guard on published (supports Status or Select)
    const statusName = getStatusName(props);
    if (!isPublishedStatus(statusName)) {
      const t = extractText(getPropAny(props, ['Title'])?.title) || page.id;
      console.log('Skipping (not published):', t, `(status: ${statusName || '—'})`);
      continue;
    }

    const title = extractText(getPropAny(props, ['Title'])?.title) || 'Untitled';
    const slug =
      extractText(getPropAny(props, ['Slug'])?.rich_text) || slugify(title);

    // Language can be select or rich_text; normalize to short codes if needed
    let language =
      extractText(getPropAny(props, ['Language'])?.rich_text) ||
      getPropAny(props, ['Language'])?.select?.name ||
      'en';
    const langMap: Record<string, string> = {
      English: 'en', Eng: 'en',
      Hindi: 'hi', 'हिंदी': 'hi',
      Bengali: 'bn', Bangla: 'bn', 'বাংলা': 'bn'
    };
    language = (langMap[language] ?? language).toLowerCase();

    const publishedAt =
      getPropAny(props, ['PublishedAt', 'Published Date'])?.date?.start ||
      page.last_edited_time ||
      new Date().toISOString();

    // YouTube (optional)
    const ytUrl =
      getPropAny(props, ['YouTube', 'Youtube', 'Video URL', 'Video'])?.url ||
      extractText(getPropAny(props, ['YouTube ID', 'YouTubeId', 'VideoId'])?.rich_text);
    const youtubeId = extractYouTubeId(ytUrl);

    // Markdown body
    let md = await pageToMarkdown(page.id);
    if (typeof md !== 'string') md = '';

    // Download inline images & rewrite
    const imgUrls = Array.from((md || '').matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g))
      .map((m) => m[1])
      .filter((u): u is string => !!u);
    for (const url of new Set(imgUrls)) {
      try {
        await download(url, localAssetPath(url));
      } catch {
        /* ignore download errors */
      }
    }
    md = rewriteImageLinks(md);

    // Cover (optional)
    const coverUrl =
      page.cover?.external?.url || page.cover?.file?.url || null;
    let cover: string | null = null;
    if (coverUrl) {
      try {
        const outPath = localAssetPath(coverUrl);
        await download(coverUrl, outPath);
        cover = publicAssetUrl(basename(outPath));
      } catch {
        cover = null;
      }
    }

    // Excerpt, word count, reading time
    const plain = (md || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/[#>*_~`>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const readingTime = Math.max(1, Math.round((wordCount || 0) / 200));
    const excerpt = sanitizeOneLine(
      extractText(getPropAny(props, ['Excerpt'])?.rich_text) || plain.slice(0, 180)
    );

    // YAML front-matter (safe)
    const front = fmObj({
      title,
      slug,
      excerpt,
      tags: (getPropAny(props, ['Tags'])?.multi_select ?? []).map((t: any) => t.name),
      cover: cover ?? undefined,
      status: 'Published',
      publishedAt,
      language,
      wordCount,
      readingTime,
      youtubeId: youtubeId ?? undefined
    });
    const fm = `---\n${yamlStringify(front)}---\n`;

    // Write file (use slug.language.md to avoid overwrites across languages)
    const filename = `${slug}.${language}.md`;
    writeFileSync(join(OUT_DIR, filename), fm + md);
    writtenFiles.push(filename);
    console.log('Synced:', filename.replace(/\.md$/, ''));
  }

  /** Build roadmap/micro-updates JSON (per-slug, per-language statuses) */
  // We need all rows (not only Published) to show "coming soon" languages
  const allRows = await notion.databases.query({ database_id: NOTION_DB_ID } as any);

  const supported = (process.env.I18N_LOCALES ?? 'en:English')
    .split(',')
    .map((s: string) => s.split(':')[0].trim());

  const groups = new Map<
    string,
    { title: string; items: Array<{ code: string; status: string; url: string | null; date: string | null }> }
  >();

  for (const page of (allRows.results as any[]) ?? []) {
    const props = page.properties ?? {};
    const title = extractText(getPropAny(props, ['Title'])?.title) || 'Untitled';
    const slug =
      extractText(getPropAny(props, ['Slug'])?.rich_text) || slugify(title);
    let language =
      extractText(getPropAny(props, ['Language'])?.rich_text) ||
      getPropAny(props, ['Language'])?.select?.name ||
      'en';
    const langMap: Record<string, string> = {
      English: 'en', Eng: 'en',
      Hindi: 'hi', 'हिंदी': 'hi',
      Bengali: 'bn', Bangla: 'bn', 'বাংলা': 'bn'
    };
    language = (langMap[language] ?? language).toLowerCase();

    const statusName = getStatusName(props) || 'Unknown';
    const isPub = isPublishedStatus(statusName);
    const date =
      getPropAny(props, ['PublishedAt', 'Published Date'])?.date?.start ||
      page.last_edited_time ||
      null;

    const url = isPub ? `/${language}/blog/${slug}` : null;
    const g = groups.get(slug) ?? { title, items: [] };
    g.title = title;
    g.items.push({ code: language, status: statusName, url, date });
    groups.set(slug, g);
  }

  const updates = Array.from(groups.entries()).map(([slug, g]) => {
    const langs = supported.map((code) => {
      const pub = g.items.find((i) => i.code === code && isPublishedStatus(i.status));
      if (pub) return { code, status: 'Published', url: pub.url, date: pub.date };
      const any = g.items.find((i) => i.code === code);
      if (any) return { code, status: any.status, url: null, date: any.date ?? null };
      return { code, status: 'Coming soon', url: null, date: null };
    });
    const completeness = langs.every((l) => l.status === 'Published') ? 1 : 0;
    return { slug, title: g.title, langs, completeness };
  }).sort((a, b) => b.completeness - a.completeness);

  writeFileSync('public/updates.json', JSON.stringify(updates, null, 2));
  console.log('Wrote updates.json with', updates.length, 'items');

  console.log('✅ Notion → Markdown synced.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
