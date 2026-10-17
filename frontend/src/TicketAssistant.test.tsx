import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TicketAssistant from './TicketAssistant';
import { REFERENCE_URL, TARGET_SALE_AT, TARGET_URL } from './ticketPlanning';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T04:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function openChecklist() {
  fireEvent.click(screen.getByText('逐步购票核对'));
}

describe('local ticket assistant', () => {
  it('defaults to the target and the confirmed highest-first, center-or-aisle strategy', () => {
    render(<TicketAssistant />);
    expect(screen.getByRole('button', { name: '目标购票准备' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('spinbutton', { name: /^票数/ })).toHaveValue(1);
    expect(screen.getByText(/初值 1 张待你确认/)).toBeInTheDocument();
    expect(screen.getByLabelText('座位位置偏好')).toHaveValue('either');
    expect(screen.getByText('2,500 → 2,000 → 1,500 → 900 THB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开目标活动官网' })).toHaveAttribute('href', TARGET_URL);
    expect(screen.getByText(/海报写 11:00 PM，与正文冲突/)).toBeInTheDocument();
    expect(screen.getByText(/时钟来源：本机时间/)).toBeInTheDocument();
  });

  it('reaches the scheduled instant without claiming that tickets are available and cleans its timer', () => {
    vi.setSystemTime(new Date(Date.parse(TARGET_SALE_AT) - 1000));
    const { unmount } = render(<TicketAssistant />);
    expect(screen.getByRole('timer')).toHaveTextContent('01秒');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('已到计划开售时间，请以官网状态为准');
    expect(screen.queryByText(/开售成功|抢票成功/)).not.toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('updates known subtotals at purchase limits and keeps payment fees unestimated', () => {
    render(<TicketAssistant />);
    const budget = screen.getByRole('region', { name: '预算核对' });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^票数/ }), { target: { value: '4' } });
    expect(budget).toHaveTextContent('10,120');
    expect(budget).toHaveTextContent('票面 10,000 + 服务费 120');
    fireEvent.change(screen.getByLabelText(/总预算/), { target: { value: '10120' } });
    expect(budget).toHaveTextContent('加上支付费后是否仍在预算内');
    fireEvent.change(screen.getByLabelText(/总预算/), { target: { value: '10119.99' } });
    expect(budget).toHaveTextContent('已知小计已超出预算');
    expect(budget).toHaveTextContent('计费基数未核实');
    expect(budget).toHaveTextContent('3.25%');
    fireEvent.change(screen.getByRole('spinbutton', { name: /^票数/ }), { target: { value: '5' } });
    expect(screen.getByRole('spinbutton', { name: /^票数/ })).toHaveAttribute('aria-invalid', 'true');
    expect(budget).not.toHaveTextContent('10,120');
    expect(budget).toHaveTextContent('请先修正票数或票档');
  });

  it('only advances tiers after an explicit unavailable report, and clears reports when preferences change', () => {
    render(<TicketAssistant />);
    fireEvent.click(screen.getByText('逐档人工记录与座区参考'));
    fireEvent.change(screen.getByLabelText('2,000 THB · 人工记录'), { target: { value: 'available' } });
    expect(screen.getByText(/下一步核对 2,500 THB/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('2,500 THB · 人工记录'), { target: { value: 'unavailable' } });
    expect(screen.getByText(/下一步核对 2,000 THB/)).toHaveTextContent('该记录不保证当前库存或预订成功');
    expect(screen.getByRole('region', { name: '预算核对' })).toHaveTextContent('2,030');
    expect(screen.getByRole('region', { name: '预算核对' })).toHaveTextContent('待核对档已知小计（2,000 THB）');
    fireEvent.change(screen.getByRole('spinbutton', { name: /^票数/ }), { target: { value: '2' } });
    expect(screen.getByLabelText('2,500 THB · 人工记录')).toHaveValue('unknown');
    expect(screen.getByLabelText('2,000 THB · 人工记录')).toHaveValue('unknown');
    expect(screen.getByText(/下一步核对 2,500 THB/)).toBeInTheDocument();
  });

  it('does not show a purchase estimate when all tiers are manually marked unavailable', () => {
    render(<TicketAssistant />);
    fireEvent.click(screen.getByText('逐档人工记录与座区参考'));
    ['2,500', '2,000', '1,500', '900'].forEach((price) => fireEvent.change(screen.getByLabelText(`${price} THB · 人工记录`), { target: { value: 'unavailable' } }));
    const budget = screen.getByRole('region', { name: '预算核对' });
    expect(budget).toHaveTextContent('当前没有待核对档');
    expect(budget).not.toHaveTextContent('待核对档已知小计');
    expect(screen.queryByText(/下一步核对/)).not.toBeInTheDocument();
  });

  it('keeps reference rules separate and clears target preferences, checks and inventory reports on switching', () => {
    const clearInterval = vi.spyOn(window, 'clearInterval');
    render(<TicketAssistant />);
    fireEvent.change(screen.getByLabelText(/总预算/), { target: { value: '5000' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /^票数/ }), { target: { value: '2' } });
    fireEvent.click(screen.getByText('逐档人工记录与座区参考'));
    fireEvent.change(screen.getByLabelText('2,500 THB · 人工记录'), { target: { value: 'unavailable' } });
    openChecklist();
    fireEvent.click(screen.getByRole('checkbox', { name: '登录与验证：人工已核对' }));
    expect(screen.getByText('1/7 人工已核对')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '参考流程核对' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/总预算/)).not.toBeInTheDocument();
    expect(screen.queryByText('2,500 → 2,000 → 1,500 → 900 THB')).not.toBeInTheDocument();
    expect(screen.getByText(/5,900 → 4,900 → 3,900 → 2,900 → 1,900/)).toBeInTheDocument();
    expect(screen.getByText(/每张另加塑料票 20 THB/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开参考活动官网' })).toHaveAttribute('href', REFERENCE_URL);
    expect(screen.getByText('0/7 人工已核对')).toBeInTheDocument();
    openChecklist();
    expect(screen.getByRole('checkbox', { name: '登录与验证：人工已核对' })).not.toBeChecked();
    expect(clearInterval).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '目标购票准备' }));
    expect(screen.getByRole('spinbutton', { name: /^票数/ })).toHaveValue(1);
    expect(screen.getByLabelText(/总预算/)).toHaveValue('');
    fireEvent.click(screen.getByText('逐档人工记录与座区参考'));
    expect(screen.getByLabelText('2,500 THB · 人工记录')).toHaveValue('unknown');
    expect(screen.getByText('0/7 人工已核对')).toBeInTheDocument();
  });

  it('records and resets human checks without claiming platform validation', () => {
    render(<TicketAssistant />);
    openChecklist();
    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(7);
    checks.forEach((checkbox) => fireEvent.click(checkbox));
    expect(screen.getByText('7/7 人工已核对')).toBeInTheDocument();
    expect(screen.getByText(/不代表平台验证、锁票或付款成功/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重置人工核对' }));
    checks.forEach((checkbox) => expect(checkbox).not.toBeChecked());
    expect(screen.getByRole('button', { name: '重置人工核对' })).toBeDisabled();
  });

  it('does not request a platform, open a window, or persist preferences during local interactions or countdown ticks', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null);
    const persist = vi.spyOn(Storage.prototype, 'setItem');
    render(<TicketAssistant />);
    fireEvent.change(screen.getByLabelText(/总预算/), { target: { value: '9999' } });
    openChecklist();
    fireEvent.click(screen.getByRole('checkbox', { name: '支付页核对：人工已核对' }));
    act(() => { vi.advanceTimersByTime(86401000); });
    fireEvent.click(screen.getByRole('button', { name: '参考流程核对' }));
    fireEvent.click(screen.getByRole('button', { name: '目标购票准备' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    const official = screen.getByRole('link', { name: '打开目标活动官网' });
    expect(official).toHaveAttribute('target', '_blank');
    expect(official).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(screen.getByText('逐档人工记录与座区参考'));
    expect(screen.getByRole('link', { name: '查看官方座区及权益图' })).toHaveAttribute('href', 'https://atkmedia.allticket.com/images/up/26144/141026LenamiuFinal_Planzone_Poster.jpg');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '开售准备与购票核对' })).queryByRole('textbox', { name: /姓名|证件|密码|银行卡/ })).not.toBeInTheDocument();
  });
});
