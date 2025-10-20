import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),                // we’ll fall back to file slug if missing
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    status: z.enum(['Draft','Published']).default('Published'),
    publishedAt: z.string().or(z.date()),
    language: z.string().default('en'),         // <-- important
    youtubeId: z.string().optional(),           // optional, if you added it
    wordCount: z.number().optional(),
    readingTime: z.number().optional()
  })
});

export const collections = { posts };
