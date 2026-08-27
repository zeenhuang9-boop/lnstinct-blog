import type { ContentStatus, Post, PostKind, Project } from '@/domain/types';

/** 后台新建/编辑时由页面表单提交的输入（与 Task 1 Zod schema 对齐）。 */
export type PostInput = {
  kind: PostKind;
  title: string;
  summary?: string;
  content: Post['content'];
  tags: string[];
};

export type ProjectInput = {
  title: string;
  description: string;
  repositoryUrl: string;
  liveUrl?: string;
  tags: string[];
  featured?: boolean;
};

/** 管理员仓储：所有写操作调用方都必须先完成管理员身份校验。 */
export interface AdminContentRepository {
  listAllPosts(): Promise<Post[]>;
  getPostById(id: string): Promise<Post | null>;
  createPost(input: PostInput): Promise<Post>;
  updatePost(id: string, input: PostInput): Promise<Post>;
  setPostStatus(id: string, status: ContentStatus): Promise<Post>;
  /** 永久删除，一次只能处理一个明确 ID。 */
  deletePost(id: string): Promise<void>;

  listAllProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, input: ProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  reorderProjects(ids: string[]): Promise<void>;
}
