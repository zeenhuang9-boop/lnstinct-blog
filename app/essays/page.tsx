import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// 公开层统一为「文章 / 学习记录」：旧散文归入学习记录，列表重定向。
export default function EssaysPage() {
  redirect('/learning');
}
