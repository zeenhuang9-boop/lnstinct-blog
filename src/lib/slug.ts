/** 将标题变为可读、可复现的路径片段；中文保留以维持原题语义。 */
export function slugifyTitle(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}
