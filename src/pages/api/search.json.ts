import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = (await getCollection("posts")).filter((p:any) => (p.data.status ?? "Published") === "Published");
  const items = posts.map((p:any) => ({
    title: p.data.title,
    slug: p.data.slug ?? p.slug,
    excerpt: p.data.excerpt ?? "",
    language: p.data.language ?? "",
    cover: p.data.cover ?? "",
    date: String(p.data.publishedAt)
  }));
  return new Response(JSON.stringify(items), { headers: { "content-type": "application/json" } });
};
