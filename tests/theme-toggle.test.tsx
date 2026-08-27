import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeToggle } from '@/components/theme-toggle';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('默认浅色，点击切换为深色并持久化', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: '切换主题' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('lnstinct-theme')).toBe('dark');
  });

  it('从 localStorage 恢复深色偏好', async () => {
    window.localStorage.setItem('lnstinct-theme', 'dark');
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: '切换主题' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('lnstinct-theme')).toBe('light');
  });
});
