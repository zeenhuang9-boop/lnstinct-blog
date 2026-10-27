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

      <section aria-labelledby="about-awards-title" className="space-y-4 text-sm leading-relaxed text-ink-soft dark:text-cream-soft">
        <h2 id="about-awards-title" className="font-serif text-xl font-bold text-ink dark:text-cream">
          获奖
        </h2>
        <p>2026 年获奖记录：</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>全国大学生电工数学建模竞赛（电工杯） · 全国二等奖</li>
          <li>APMCM 亚太地区大学生数学建模竞赛 · 全国二等奖</li>
          <li>大学生创新创业大赛 · 省级银奖</li>
          <li>全国大学生统计建模大赛 · 湖北赛区三等奖</li>
          <li>全国大学生电子商务“创新、创意及创业”挑战赛 · 校赛三等奖</li>
          <li>新文科 · 校赛二等奖</li>
          <li>全国高校商业精英挑战赛创新创业竞赛 · 校级优秀奖</li>
        </ul>
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
