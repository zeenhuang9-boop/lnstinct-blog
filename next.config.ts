import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 本地验收用 127.0.0.1 / localhost 访问 dev 资源时允许跨源加载，
  // 否则 Tiptap 编辑器等客户端组件在开发模式下无法加载 chunk。
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
