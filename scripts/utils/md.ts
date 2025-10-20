import { NotionToMarkdown } from 'notion-to-md';
import { notion } from './notion';

const n2m = new NotionToMarkdown({ notionClient: notion });

export async function pageToMarkdown(pageId: string): Promise<string> {
  try {
    const blocks = await n2m.pageToMarkdown(pageId);
    const out = n2m.toMarkdownString(blocks).parent;
    return typeof out === 'string' ? out : '';
  } catch {
    // if Notion returns unsupported blocks or page has no content
    return '';
  }
}
