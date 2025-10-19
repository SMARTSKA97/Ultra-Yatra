import { NotionToMarkdown } from 'notion-to-md';
import { notion } from './notion';

const n2m = new NotionToMarkdown({ notionClient: notion });

export async function pageToMarkdown(pageId: string) {
  const blocks = await n2m.pageToMarkdown(pageId);
  return n2m.toMarkdownString(blocks).parent;
}
