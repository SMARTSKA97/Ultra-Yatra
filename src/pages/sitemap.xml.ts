import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;
export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString() ?? "http://localhost:4321";
  const posts = (await getCollection("posts")).filter((p:any) => (p.data.status ?? "Published") === "Published");
  const urls = [
    `${base}/`, `${base}/blog`, `${base}/about`, `${base}/tags`,
    ...posts.map((p:any) => `${base}/blog/${p.data.slug ?? p.slug}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
};
