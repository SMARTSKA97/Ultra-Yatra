import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),     // robust fallback to file slug
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    status: z.enum(['Draft','Published']).default('Published'),
    publishedAt: z.string().or(z.date()),
    language: z.string().optional(),
    template: z.string().optional()
  })
});

export const collections = { posts };
