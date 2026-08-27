import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/config/site';
import { getContentDataSource } from '@/lib/content/data-source';
import { PostList } from '@/components/post-list';
import { ProjectList } from '@/components/project-list';
import { SectionHeading } from '@/components/section-heading';
import { EmptyState } from '@/components/empty-state';

export const metadata: Metadata = {
  title: '首页',
  alternates: { canonical: '/' },
};

export const dynamic = 'force-dynamic';

import type { Post as PostType } from '@/domain/types';

const sortByDate = (posts: PostType[]) =>
  [...posts].sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));

export default async function HomePage() {
  const repository = await getContentDataSource();

  const [articles, learning, projects] = await Promise.all([
    repository.listPublishedPosts({ kind: 'article' }),
    repository.listPublishedPosts({ kind: 'learning' }),
    repository.listProjects(),
  ]);

  const featuredProjects = projects.filter((project) => project.featured).slice(0, 3);
  const latestArticles = sortByDate(articles).slice(0, 5);
  const latestLearning = sortByDate(learning).slice(0, 5);

  return (
    <div className="space-y-14">
      <section aria-labelledby="hero-title" className="border-b border-rule pb-10 dark:border-night-rule">
        <h1 id="hero-title" className="font-serif text-4xl font-bold leading-tight text-ink dark:text-cream sm:text-5xl">
          小泽 <span className="text-rust dark:text-rust-soft">·</span> {siteConfig.name}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft dark:text-cream-soft">
          我是小泽，欢迎来到我的博客
        </p>
      </section>

      <section aria-labelledby="about-summary-title">
        <SectionHeading id="about-summary-title">关于</SectionHeading>
        <div className="space-y-3 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
          <p>
            我是一名软件工程学生，长期参与数学建模实践，并担任数学建模协会负责人。我在这里分享我的技术文章和学习记录，记录成长的点滴。
          </p>
          <p>
            这个站点是我的私人空间，所有内容都由我本人书写，暂不开放评论与注册。
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/learning"
            className="border border-rust px-4 py-2 text-sm text-rust transition-colors hover:bg-rust hover:text-paper dark:border-rust-soft dark:text-rust-soft dark:hover:bg-rust-soft dark:hover:text-night"
          >
            学习记录
          </Link>
          <Link
            href="/about"
            className="border border-rule px-4 py-2 text-sm text-ink-soft transition-colors hover:border-rust hover:text-rust dark:border-night-rule dark:text-cream-soft dark:hover:border-rust-soft dark:hover:text-rust-soft"
          >
            了解更多
          </Link>
        </div>
      </section>

      <section aria-labelledby="featured-projects-title">
        <SectionHeading id="featured-projects-title">精选项目</SectionHeading>
        {featuredProjects.length > 0 ? (
          <ProjectList projects={featuredProjects} />
        ) : (
          <EmptyState title="还没有项目" description="项目导入后会在这里展示。" />
        )}
        <p className="mt-4">
          <Link href="/projects" className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft">
            查看全部项目 →
          </Link>
        </p>
      </section>

      <section aria-labelledby="latest-articles-title">
        <SectionHeading id="latest-articles-title">最新文章</SectionHeading>
        <PostList posts={latestArticles} basePath="/articles" emptyTitle="还没有文章" emptyDescription="发布后会出现在这里。" />
        {articles.length > 0 ? (
          <p className="mt-4">
            <Link href="/articles" className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft">
              查看全部文章 →
            </Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="latest-learning-title">
        <SectionHeading id="latest-learning-title">最新学习记录</SectionHeading>
        <PostList posts={latestLearning} basePath="/learning" emptyTitle="还没有学习记录" emptyDescription="把每天的学习内容写成文章后会出现在这里。" />
        {learning.length > 0 ? (
          <p className="mt-4">
            <Link href="/learning" className="text-sm text-rust underline-offset-4 hover:underline dark:text-rust-soft">
              查看全部学习记录 →
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
