import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 本地验收用 127.0.0.1 / localhost 访问 dev 资源时允许跨源加载，
  // 否则 Tiptap 编辑器等客户端组件在开发模式下无法加载 chunk。
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    serverActions: {
      // Server Action 的请求体默认只有 1 MB，而图片上传走的就是 Server Action，
      // 站点自己的校验却允许到 5 MiB —— 两层限制对不上时，大于 1 MB 的真实照片会在
      // 到达校验函数之前就被 Next 以 413 拒绝。这里把上限抬到 6 MB：
      // 5 MiB 的图 + multipart 边界与字段开销（官方建议留 10–20 KB，这里给了约 1 MB 余量）。
      // 该上限只作用于 Server Action 的请求体，不影响页面与静态资源。
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
