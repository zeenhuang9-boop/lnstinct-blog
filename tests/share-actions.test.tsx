import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ShareActions } from '@/components/share-actions';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShareActions', () => {
  it('不支持 navigator.share 时回退为复制链接', async () => {
    // 先 setup userEvent，再替换 navigator，避免 user-event 的剪贴板桩覆盖我们注入的 writeText。
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    const url = 'https://example.com/articles/hello';

    render(<ShareActions title="你好世界" url={url} />);

    await user.click(screen.getByRole('button', { name: '复制链接' }));

    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('支持 navigator.share 时调用系统分享', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    const url = 'https://example.com/articles/hello';

    render(<ShareActions title="你好世界" url={url} />);

    // canShare 在挂载后异步判定。
    await user.click(await screen.findByRole('button', { name: '分享' }));

    expect(share).toHaveBeenCalledWith({ title: '你好世界', url });
  });
});
