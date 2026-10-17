import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BrowserSessionState from './BrowserSessionState';
import type { BrowserProfileStatus } from './types';

const saved: BrowserProfileStatus = {
  platform: 'allticket', persistence_enabled: true, saved_data_present: true,
  login_status: 'unverified', browser_in_use: false, can_clear: true,
};
const props = { platform: 'allticket' as const, persistenceEnabled: true, sessionKey: '', actionPending: false };

function response(data: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => data } as Response;
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('browser session reuse status', () => {
  it('explains automatic reuse without treating saved browser data as verified login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(saved));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} />);
    expect(await screen.findByText('已保存浏览器数据 · 登录未验证')).toBeInTheDocument();
    expect(screen.getByText(/自动复用 TicketPilot 在后端机器上的专用浏览器数据，无需手动保存/)).toBeInTheDocument();
    expect(screen.getByText('保存的数据不代表已登录，是否仍有效请以官网页面为准。')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/browser-profiles/allticket', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows disabled persistence and still permits clearing previously saved data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...saved, persistence_enabled: false })));
    render(<BrowserSessionState {...props} persistenceEnabled={false} />);
    expect(await screen.findByText('已保存浏览器数据 · 登录未验证')).toBeInTheDocument();
    expect(screen.getByText('自动保留未开启')).toBeInTheDocument();
    expect(screen.getByText('当前使用临时浏览器，不会复用之前保存的数据。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeEnabled();
  });

  it.each([
    { profile: { ...saved, saved_data_present: false, can_clear: false }, pending: false },
    { profile: { ...saved, browser_in_use: true, can_clear: false }, pending: false },
    { profile: saved, pending: true },
  ])('blocks clearing unavailable or busy browser data %#', async ({ profile, pending }) => {
    const fetchMock = vi.fn().mockResolvedValue(response(profile));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} actionPending={pending} />);
    await screen.findByText(/浏览器数据.*登录未验证/);
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '清除保存的浏览器数据' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (profile.browser_in_use) expect(screen.getByText('浏览器使用中，结束会话后可清除数据。')).toBeInTheDocument();
  });

  it('clears only the selected platform and updates the returned status', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ...saved, platform: 'ttm' }))
      .mockResolvedValueOnce(response({ ...saved, platform: 'ttm', saved_data_present: false, can_clear: false }));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} platform="ttm" />);
    await screen.findByText('已保存浏览器数据 · 登录未验证');
    fireEvent.click(screen.getByRole('button', { name: '清除保存的浏览器数据' }));
    expect(await screen.findByText('已清除该平台保存的浏览器数据。下次需要时请在官网重新登录。')).toBeInTheDocument();
    expect(screen.getByText('暂无已保存的浏览器数据 · 登录未验证')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/browser-profiles/ttm/clear', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeDisabled();
  });

  it('handles a busy conflict by showing the error and reloading current status', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(saved))
      .mockResolvedValueOnce(response({ detail: '浏览器正在使用，请先结束会话。' }, 409))
      .mockResolvedValueOnce(response({ ...saved, browser_in_use: true, can_clear: false }));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} />);
    await screen.findByText('已保存浏览器数据 · 登录未验证');
    fireEvent.click(screen.getByRole('button', { name: '清除保存的浏览器数据' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('浏览器正在使用，请先结束会话。');
    expect(await screen.findByText('浏览器使用中，结束会话后可清除数据。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeDisabled();
    expect(screen.queryByText(/已清除该平台/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('allows retry after a failed status lookup without implying data was absent', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(response(saved));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('无法连接后端');
    expect(screen.queryByText('暂无已保存的浏览器数据 · 登录未验证')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '刷新浏览器会话状态' }));
    expect(await screen.findByText('已保存浏览器数据 · 登录未验证')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refreshes the saved state when a browser session ends', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ...saved, browser_in_use: true, can_clear: false }))
      .mockResolvedValueOnce(response(saved));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<BrowserSessionState {...props} sessionKey="research-1:active" />);
    expect(await screen.findByText('浏览器使用中，结束会话后可清除数据。')).toBeInTheDocument();
    rerender(<BrowserSessionState {...props} sessionKey="" />);
    await waitFor(() => expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeEnabled());
    expect(screen.queryByText('浏览器使用中，结束会话后可清除数据。')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rechecks delayed browser cleanup after a session closes and stops when released', async () => {
    vi.useFakeTimers();
    const busy = response({ ...saved, browser_in_use: true, can_clear: false });
    const fetchMock = vi.fn().mockResolvedValueOnce(busy).mockResolvedValueOnce(busy).mockResolvedValue(response(saved));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<BrowserSessionState {...props} sessionKey="research-1:active" />);
    await act(async () => {});
    rerender(<BrowserSessionState {...props} sessionKey="" />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('button', { name: '清除保存的浏览器数据' })).toBeEnabled();
    expect(screen.queryByText('浏览器使用中，结束会话后可清除数据。')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([path]) => path === '/api/browser-profiles/allticket')).toBe(true);
  });

  it('bounds automatic busy checks and allows an explicit refresh to restart them', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => response({ ...saved, browser_in_use: true, can_clear: false }));
    vi.stubGlobal('fetch', fetchMock);
    render(<BrowserSessionState {...props} />);
    await act(async () => {});
    for (let index = 0; index < 20; index += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    }
    expect(fetchMock).toHaveBeenCalledTimes(16);
    fireEvent.click(screen.getByRole('button', { name: '刷新浏览器会话状态' }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchMock).toHaveBeenCalledTimes(18);
  });

  it('cancels the previous platform timer and all checks on unmount', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async (path: string) => response({
      ...saved, platform: path.endsWith('/ttm') ? 'ttm' : 'allticket', browser_in_use: true, can_clear: false,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender, unmount } = render(<BrowserSessionState {...props} />);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    rerender(<BrowserSessionState {...props} platform="ttm" />);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/browser-profiles/allticket', '/api/browser-profiles/ttm', '/api/browser-profiles/ttm',
    ]);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
