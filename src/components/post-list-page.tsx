import type { PostKind } from '@/domain/types';
import { getContentDataSource } from '@/lib/content/data-source';
import { PostList } from '@/components/post-list';

/**
 * 列表页：文章 / 学习记录。按需求不展示标签与搜索，仅按发布时间倒序。
 */
export async function PostListPage({
  kind,
}: {
  kind: PostKind;
}): Promise<React.ReactElement> {
  const repository = await getContentDataSource();
  const posts = (await repository.listPublishedPosts({ kind })).sort((a, b) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
  );

  const isArticle = kind === 'article';
  const basePath = isArticle ? '/articles' : '/learning';
  const title = isArticle ? '文章' : '学习记录';
  const description = isArticle
    ? '我的文学世界：把每天的阅读、写作和思考写下来。'
    : '我的学习笔记：把每天的学习内容写成文章。';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink dark:text-cream">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft dark:text-cream-soft">{description}</p>
      </header>

      <section aria-label={`${title}列表`}>
        <PostList
          posts={posts}
          basePath={basePath}
          emptyTitle={isArticle ? '还没有文章' : '还没有学习记录'}
          emptyDescription={isArticle ? '发布后会出现在这里。' : '把每天的学习内容写成文章后会出现在这里。'}
        />
      </section>
    </div>
  );
}
