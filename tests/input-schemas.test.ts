import { describe, expect, it } from 'vitest';

import { postInputSchema, projectInputSchema } from '@/domain/input-schemas';

describe('postInputSchema', () => {
  const validPost = {
    kind: 'article',
    title: 'A careful title',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: ['writing'],
  };

  it('rejects a blank title', () => {
    expect(postInputSchema.safeParse({ ...validPost, title: '   ' }).success).toBe(false);
  });

  it('rejects unknown post kinds', () => {
    expect(postInputSchema.safeParse({ ...validPost, kind: 'note' }).success).toBe(false);
  });

  it('rejects more than five tags', () => {
    expect(postInputSchema.safeParse({ ...validPost, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
  });

  it('accepts Markdown links and fenced code after conversion to Tiptap JSON', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: '文档',
            marks: [{ type: 'link', attrs: { href: 'https://example.com', title: null } }],
          }],
        },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const ok = true;' }] },
      ],
    };

    expect(postInputSchema.safeParse({ ...validPost, content }).success).toBe(true);
  });
});

describe('projectInputSchema', () => {
  const validProject = {
    title: 'Blog source',
    description: 'A public code repository.',
    repositoryUrl: 'https://github.com/example/blog',
    tags: ['TypeScript'],
  };

  it('rejects invalid repository URLs', () => {
    expect(projectInputSchema.safeParse({ ...validProject, repositoryUrl: 'not a url' }).success).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.com/blog'])(
    'rejects a repository URL with the %s protocol',
    (repositoryUrl) => {
      expect(projectInputSchema.safeParse({ ...validProject, repositoryUrl }).success).toBe(false);
    },
  );

  it('rejects more than five tags', () => {
    expect(projectInputSchema.safeParse({ ...validProject, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false);
  });
});
