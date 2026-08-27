import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

function decodeSlugParam(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? value : decoded;
  } catch {
    return value;
  }
}

// 公开层统一为「文章 / 学习记录」：旧散文详情重定向到学习记录详情。
export default async function EssayDetailPage({ params }: { params: Promise<Params> }) {
  const { slug: rawSlug } = await params;
  redirect(`/learning/${decodeSlugParam(rawSlug)}`);
}
