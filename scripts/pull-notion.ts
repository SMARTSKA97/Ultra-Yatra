import dotenv from 'dotenv';
dotenv.config();

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { notion, NOTION_DB_ID } from './utils/notion';
import { pageToMarkdown } from './utils/md';
import { slugify } from './utils/slugify';
import { download, localAssetPath, publicAssetUrl } from './utils/download';

const OUT_DIR = 'src/content/posts';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

type AnyRecord = Record<string, any>;

function getProp(props: AnyRecord | undefined, name: string) {
  return props ? (props as AnyRecord)[name] : undefined;
}
function getPropAny(props: AnyRecord | undefined, names: string[]) {
  if (!props) return undefined;
  for (const n of names) if ((props as AnyRecord)[n] != null) return (props as AnyRecord)[n];
  return undefined;
}
function text(rich: any[] | undefined) {
  return (rich ?? []).map((t: any) => t?.plain_text ?? '').join('');
}
function clean(s: string) {
  return (s || '').replace(/"/g, '\\"');
}

async function coverUrl(page: AnyRecord) {
  const u: string | null = page.cover?.external?.url || page.cover?.file?.url || null;
  if (!u) return null;
  const out = localAssetPath(u);
  await download(u, out);
  return publicAssetUrl(basename(out));
}

function rewriteImages(md: string) {
  return md.replace(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g, (_m, url: string) => {
    const name = basename(new URL(url).pathname);
    return _m.replace(url, `/notion-assets/${name}`);
  });
}

async function main() {
  const q = await notion.databases.query({ database_id: NOTION_DB_ID } as any);
  const results = (q.results as any[]) ?? [];

  // Sort by published date desc (fallback last_edited_time)
  results.sort((a: AnyRecord, b: AnyRecord) => {
    const pa = getPropAny(a.properties, ['published date','PublishedAt','Published Date'])?.date?.start ?? a.last_edited_time;
    const pb = getPropAny(b.properties, ['published date','PublishedAt','Published Date'])?.date?.start ?? b.last_edited_time;
    return new Date(pb).getTime() - new Date(pa).getTime();
  });

  for (const page of results) {
    const props = (page.properties ?? {}) as AnyRecord;

    const statusProp = getPropAny(props, ['status','Status']);
    const status = statusProp?.select?.name ?? 'Published';
    if (statusProp && status !== 'Published') continue;

    const title = text(getPropAny(props, ['title','Title'])?.title) || 'Untitled';
    const slug  = text(getPropAny(props, ['slug','Slug'])?.rich_text) || slugify(title);
    const lang  = text(getPropAny(props, ['language','Language'])?.rich_text) || getPropAny(props, ['language','Language'])?.select?.name || '';
    const tmpl  = text(getPropAny(props, ['template','Template'])?.rich_text) || getPropAny(props, ['template','Template'])?.select?.name || '';
    const pdate = getPropAny(props, ['published date','PublishedAt','Published Date'])?.date?.start || page.last_edited_time;

    let md = await pageToMarkdown(page.id);

    // derive excerpt
    const excerpt = md
      .replace(/```[\s\S]*?```/g,'')
      .replace(/`[^`]+`/g,'')
      .replace(/!\[[^\]]*\]\([^)]+\)/g,'')
      .replace(/\[[^\]]*\]\([^)]+\)/g,'')
      .replace(/[#>*_~`>-]/g,' ')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0, 180);

    // download images
    const imgUrls = Array.from(md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g))
      .map(m => m[1])
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    for (const url of new Set(imgUrls)) {
      try { await download(url, localAssetPath(url)); } catch {}
    }
    md = rewriteImages(md);

    const cover = await coverUrl(page);

    const fm = [
      '---',
      `title: "${clean(title)}"`,
      `slug: "${slug}"`,
      `status: "Published"`,
      `publishedAt: "${pdate}"`,
      lang ? `language: "${clean(lang)}"` : '',
      tmpl ? `template: "${clean(tmpl)}"` : '',
      cover ? `cover: "${cover}"` : '',
      `excerpt: "${clean(excerpt)}"`,
      '---',
      ''
    ].filter(Boolean).join('\n');

    writeFileSync(join(OUT_DIR, `${slug}.md`), fm + md);
    console.log('Synced:', slug);
  }

  console.log('✅ Notion → Markdown synced.');
}

main().catch(e => { console.error(e); process.exit(1); });
