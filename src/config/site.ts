export type SiteConfig = {
  readonly name: 'lnstinct.';
  readonly author: '小泽';
  readonly description: string;
  /** 站点的对外基础 URL；本地验收默认 localhost，部署前由环境变量覆盖。 */
  readonly url: string;
};

function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

// 公开配置仅放展示所需身份，个人资料不能随着构建产物暴露。
export const siteConfig: SiteConfig = {
  name: 'lnstinct.',
  author: '小泽',
  description: 'Personal writing and projects.',
  url: resolveSiteUrl(),
};
