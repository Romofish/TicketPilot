import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { ResearchConfig, ResearchEvent, Session } from './types';

const config: ResearchConfig = {
  platforms: [{ id: 'allticket', label: 'ALL TICKET' }, { id: 'ttm', label: 'ThaiTicketMajor' }],
  browser_mode: 'headed', display_available: true, max_active_sessions: 1, capture_cooldown_seconds: 3,
};
const activeSession: Session = {
  id: 'research-1', platform: 'allticket', url: 'https://www.allticket.com/event/example',
  event_name: '测试活动', status: 'active', started_at: '2026-10-17T02:00:00Z', ended_at: null, error: null,
};
const observation: ResearchEvent = {
  id: 'observation-1', session_id: activeSession.id, kind: 'page_observation', created_at: '2026-10-17T02:01:00Z',
  data: {
    page_type: 'unknown', seat_state: 'unverified',
    visible_counts: { buttons: 7, links: 12, inputs: 2, images: 5, frames: 0 },
    evidence: { login_input_visible: false, classification: 'generic_heuristic' },
    timing: { dom_content_loaded_ms: 321, load_ms: 456, response_ms: 123, observation_ms: 11 },
  },
};

function mockApi(options: { sessions?: Session[]; events?: ResearchEvent[]; config?: ResearchConfig; launchError?: string } = {}) {
  let sessions = options.sessions ?? [];
  let events = options.events ?? [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    let data: unknown;
    let status = 200;
    if (path === '/api/config') data = options.config ?? config;
    else if (path === '/api/research/sessions' && method === 'GET') data = { sessions: [...sessions] };
    else if (path === '/api/research/sessions' && method === 'POST') {
      if (options.launchError) { data = { detail: options.launchError }; status = 503; }
      else { sessions = [activeSession]; data = activeSession; status = 201; }
    } else if (path.endsWith('/events')) data = { events: [...events] };
    else if (path.endsWith('/capture')) { events = [...events, observation]; data = observation; status = 201; }
    else if (path.endsWith('/markers')) {
      const body = JSON.parse(String(init?.body)) as { label: string };
      const marker: ResearchEvent = { id: `marker-${body.label}`, session_id: activeSession.id, kind: 'manual_marker', created_at: '2026-10-17T02:02:00Z', data: { label: body.label, meaning: 'user_reported_observation_only' } };
      events = [...events, marker]; data = marker; status = 201;
    } else if (path.endsWith('/close')) {
      const closed: Session = { ...activeSession, status: 'closed', ended_at: '2026-10-17T02:03:00Z' };
      sessions = [closed]; data = closed;
    } else if (path.endsWith('/export')) data = { schema_version: 1, session: activeSession, events };
    else throw new Error(`Unexpected test API request: ${method} ${path}`);
    return { ok: status < 400, status, json: async () => data } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => { mockApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('TicketPilot research workspace', () => {
  it('renders an empty workspace with ALL TICKET selected and no invented seat availability', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TicketPilot' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ALL TICKET/ })).toBeChecked();
    expect(screen.getByText('尚未验证')).toBeInTheDocument();
    expect(screen.getAllByText('尚未记录')).toHaveLength(3);
    expect(await screen.findByText('本地服务已连接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /T1/ })).toBeDisabled();
  });

  it('quick-fills the supplied activity without opening any external URL', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByText('本地服务已连接');
    fireEvent.click(screen.getByRole('button', { name: '目标活动' }));
    expect(screen.getByLabelText(/活动 URL/)).toHaveValue('https://www.allticket.com/event/PlsLoveFanScreeningFinalEP');
    fireEvent.click(screen.getByRole('button', { name: '参考活动' }));
    expect(screen.getByLabelText(/活动 URL/)).toHaveValue('https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty');
    expect(fetchMock.mock.calls.every(([path, init]) => String(path).startsWith('/api/') && !init?.method)).toBe(true);
  });

  it('validates the URL before creating a session', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByText('本地服务已连接');
    fireEvent.change(screen.getByLabelText(/活动 URL/), { target: { value: 'https://attacker.example/' } });
    fireEvent.click(screen.getByRole('button', { name: '打开研究浏览器' }));
    expect(await screen.findByText(/当前平台仅接受 allticket.com/)).toBeInTheDocument();
    expect(screen.getByLabelText(/活动 URL/)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('creates an ALL TICKET session and explains where manual login happens', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByText('本地服务已连接');
    fireEvent.change(screen.getByLabelText(/活动 URL/), { target: { value: activeSession.url } });
    fireEvent.change(screen.getByLabelText(/研究名称/), { target: { value: '测试活动' } });
    fireEvent.click(screen.getByRole('button', { name: '打开研究浏览器' }));
    expect(await screen.findByText('研究会话已创建。请在后端所在机器的浏览器中手动登录。')).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/research/sessions' && init?.method === 'POST');
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ platform: 'allticket', url: activeSession.url, event_name: '测试活动' });
    expect(screen.getByRole('button', { name: '打开研究浏览器' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '记录当前页面' })).toBeEnabled();
  });

  it('shows launch failures and allows retry', async () => {
    mockApi({ launchError: '浏览器未安装，请运行 npm run setup:browser。' });
    render(<App />);
    await screen.findByText('本地服务已连接');
    fireEvent.click(screen.getByRole('button', { name: '目标活动' }));
    fireEvent.click(screen.getByRole('button', { name: '打开研究浏览器' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('浏览器未安装');
    expect(screen.getByRole('button', { name: '打开研究浏览器' })).toBeEnabled();
  });

  it('records visible state and observational markers, and closes the browser session', async () => {
    const fetchMock = mockApi({ sessions: [activeSession] });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '记录当前页面' }));
    expect(await screen.findByText('456 ms')).toBeInTheDocument();
    expect(screen.getByText('未知页面')).toBeInTheDocument();
    expect(screen.getByText('尚未验证')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /秒后可再次记录/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /T2 完成手动选座/ }));
    expect(await screen.findByText('人工时间标记 · T2')).toBeInTheDocument();
    const markerCall = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/markers'));
    expect(JSON.parse(String(markerCall?.[1]?.body))).toEqual({ label: 'T2' });
    expect(fetchMock.mock.calls.every(([path]) => !/book|reserve|order|seat/.test(String(path)))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '结束会话' }));
    expect(await screen.findByText('研究会话已结束，观察记录已保留。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /T2 完成手动选座/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开研究浏览器' })).toBeEnabled();
  });

  it('uses the latest automatic page load observation for metrics', async () => {
    mockApi({ sessions: [activeSession], events: [observation, { ...observation, id: 'loaded-2', kind: 'page_loaded', data: { ...observation.data, timing: { load_ms: 987 } } }] });
    render(<App />);
    expect(await screen.findByText('987 ms')).toBeInTheDocument();
    expect(screen.queryByText('456 ms')).not.toBeInTheDocument();
    expect(screen.getByText('页面加载完成')).toBeInTheDocument();
  });

  it('exports a JSON artifact using the redacted export endpoint', async () => {
    const fetchMock = mockApi({ sessions: [activeSession], events: [observation] });
    const createObjectURL = vi.fn(() => 'blob:test-export');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '导出脱敏 JSON' }));
    expect(await screen.findByText('脱敏 JSON 已导出。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/research/sessions/research-1/export')).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
  });

  it('keeps history inspectable when no desktop display is available', async () => {
    mockApi({ sessions: [{ ...activeSession, status: 'closed' }], config: { ...config, display_available: false } });
    render(<App />);
    expect(await screen.findByText(/后端未检测到桌面显示/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开研究浏览器' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出脱敏 JSON' })).toBeEnabled();
    expect(within(screen.getByRole('region', { name: '当前研究会话' })).getByText('已结束')).toBeInTheDocument();
  });

  it('shows a recoverable error when the local API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('无法连接后端');
    mockApi();
    fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('本地服务已连接')).toBeInTheDocument();
  });
});
