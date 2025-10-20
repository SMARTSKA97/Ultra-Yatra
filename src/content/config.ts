import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    status: z.enum(['Draft','Published']).default('Published'),
    publishedAt: z.string().or(z.date()),
    language: z.string().optional(),
    template: z.string().optional(),
    wordCount: z.number().optional(),
    readingTime: z.number().optional()
  })
});

export const collections = { posts };
