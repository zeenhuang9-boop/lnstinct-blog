import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library 的自动清理依赖 vitest globals；本工程未开启 globals，显式注册以避免测试间 DOM 累积。
afterEach(() => {
  cleanup();
});
