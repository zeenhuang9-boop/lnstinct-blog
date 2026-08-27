import { z } from 'zod';

import { tiptapContentSchema } from '@/domain/tiptap-content';

const tagSchema = z.string().trim().min(1).max(32);
const tagsSchema = z.array(tagSchema).max(5);
const webUrlSchema = z.url().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'URL must use http or https' },
);

export const postInputSchema = z.object({
  kind: z.enum(['article', 'learning']),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(320).optional(),
  content: tiptapContentSchema,
  tags: tagsSchema,
}).strict();

export const projectInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  repositoryUrl: webUrlSchema,
  liveUrl: webUrlSchema.optional(),
  tags: tagsSchema,
  featured: z.boolean().optional(),
}).strict();
