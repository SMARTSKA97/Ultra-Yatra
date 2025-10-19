import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts"))
    .filter((p:any) => (p.data.status ?? "Published") === "Published")
    .sort((a:any,b:any) => new Date(String(b.data.publishedAt)).getTime() - new Date(String(a.data.publishedAt)).getTime());

  return rss({
    title: "Ultra Yatra",
    description: "My ultracycling journey — stories, learnings, data, grit.",
    site: context.site?.toString() ?? "http://localhost:4321",
    items: posts.map((p:any) => ({
      title: p.data.title,
      description: p.data.excerpt ?? "",
      link: `/blog/${p.data.slug ?? p.slug}`,
      pubDate: new Date(String(p.data.publishedAt)),
    })),
  });
}
