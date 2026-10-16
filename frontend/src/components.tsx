import type { ReactNode } from 'react';
import type { Session } from './types';

export const platformNames = { allticket: 'ALL TICKET', ttm: 'ThaiTicketMajor' };
export const statusNames = { opening: '正在打开', active: '研究中', closed: '已结束', failed: '打开失败' };
export const pageNames: Record<string, string> = {
  unknown: '未知页面', login_form: '检测到登录表单', verification_or_queue: '可能存在验证或排队',
};
export const kindNames: Record<string, string> = {
  page_observation: '页面观察', page_loaded: '页面加载完成', manual_marker: '人工时间标记', navigation: '页面导航',
  browser_error: '浏览器异常', console_summary: '控制台摘要', session_opened: '浏览器已打开',
  session_closed: '会话已结束', session_failed: '会话异常',
};
export const markerDetails = {
  T1: { label: '进入选座页面', description: '由你判断已进入选座页面' },
  T2: { label: '完成手动选座', description: '记录你在官网的手动操作' },
  T3: { label: '看到官方预订结果', description: '记录官网显示的确认结果' },
};
export function formatTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
export function duration(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value).toLocaleString('zh-CN')} ms` : '尚未记录';
}
export function Icon({ name, size = 20 }: { name: 'arrow' | 'plus' | 'activity' | 'clock' | 'download' | 'close' | 'refresh' | 'external' | 'eye'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    download: <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />,
    close: <path d="m7 7 10 10M7 17 17 7" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.5-1l2.4 3M4 15l2.4 3a7 7 0 0 0 11.5-1" /></>,
    external: <path d="M13 4h7v7m0-7L10 14M10 5H5v14h14v-5" />,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function StatusBadge({ session }: { session: Session }) {
  return <span className={`status-badge status-${session.status}`}><span />{statusNames[session.status]}</span>;
}
