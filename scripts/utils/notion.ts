import dotenv from 'dotenv';
dotenv.config(); // MUST run before reading process.env

import { Client } from '@notionhq/client';

function normalizeId(id?: string | null) {
  return (id ?? '').trim().replace(/-/g, '');
}

const token = process.env.NOTION_TOKEN;
if (!token) throw new Error('Missing NOTION_TOKEN in .env');

const rawId = process.env.NOTION_DB_ID;
export const NOTION_DB_ID = normalizeId(rawId);

if (!NOTION_DB_ID) throw new Error('Missing NOTION_DB_ID in .env');

export const notion = new Client({ auth: token });
