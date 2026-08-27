export type PostKind = 'article' | 'learning';

export type ContentStatus = 'draft' | 'published' | 'trashed';

export type ContentEvent = 'publish' | 'withdraw' | 'trash' | 'restore';

export type TiptapDocument = {
  type: 'doc';
  content: TiptapNode[];
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type Post = {
  id: string;
  slug: string;
  kind: PostKind;
  title: string;
  summary: string | null;
  content: TiptapDocument;
  tags: string[];
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  repositoryUrl: string;
  liveUrl: string | null;
  tags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

// 仓储层显式保留数据库命名，避免在界面层混入 snake_case 字段。
export type PostRow = {
  id: string;
  slug: string;
  kind: PostKind;
  title: string;
  summary: string | null;
  content: TiptapDocument;
  tags: string[];
  status: ContentStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  repository_url: string;
  live_url: string | null;
  tags: string[];
  featured: boolean;
  created_at: string;
  updated_at: string;
};
