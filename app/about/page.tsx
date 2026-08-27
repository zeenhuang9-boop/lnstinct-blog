import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '关于',
  description: '小泽与 lnstinct. 的自我介绍。',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-3xl font-bold text-ink dark:text-cream">关于</h1>
      </header>

      <section aria-labelledby="about-me-title" className="space-y-4 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
        <h2 id="about-me-title" className="font-serif text-xl font-bold text-ink dark:text-cream">
          我是谁
        </h2>
        <p>我是小泽，一名软件工程学生.</p>
        <p>
          我长期参与数学建模实践，并担任数学建模协会负责人。我在这里分享我的技术文章和学习记录，记录成长的点滴。
        </p>
      </section>

      

      <section aria-labelledby="about-notes-title" className="space-y-4 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
        <h2 id="about-notes-title" className="font-serif text-xl font-bold text-ink dark:text-cream">
          关于本站
        </h2>
        <p>本站是我的个人博客：支持亮暗主题与手机阅读。</p>
        <p>本站不提供评论、公开注册与定时发布；所有内容均由我本人书写。</p>
      </section>
    </div>
  );
}
