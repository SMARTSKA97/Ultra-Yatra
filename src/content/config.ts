import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    baseSlug: z.string(), 
    slug: z.string().optional(), 
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    // UPDATED: Added "Not started"
    status: z.enum(['Draft','Published', 'Not started']).default('Published'),
    publishedAt: z.string().or(z.date()),
    language: z.enum(['en', 'bn', 'hi']), 
    template: z.string().optional(),
    wordCount: z.number().optional(),
    readingTime: z.number().optional()
  })
});

export const collections = { posts };


