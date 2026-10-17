import { useCallback, useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { Icon, platformNames } from './components';
import type { BrowserProfileStatus, Platform } from './types';

interface Props {
  platform: Platform;
  persistenceEnabled: boolean;
  sessionKey: string;
  actionPending: boolean;
}

export default function BrowserSessionState({ platform, persistenceEnabled, sessionKey, actionPending }: Props) {
  const [profile, setProfile] = useState<BrowserProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  const busyPollsRemaining = useRef(15);

  const refresh = useCallback(async (keepError = false, background = false) => {
    const id = ++requestId.current;
    if (!background) busyPollsRemaining.current = 15;
    setLoading(true);
    if (!keepError) { setError(''); setNotice(''); }
    try {
      const result = await api<BrowserProfileStatus>(`/browser-profiles/${platform}`);
      if (id === requestId.current) setProfile(result);
    } catch (failure) {
      if (id === requestId.current) { setProfile(null); setError((failure as Error).message); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    void refresh();
    return () => { requestId.current += 1; };
  }, [refresh, sessionKey, persistenceEnabled]);

  useEffect(() => {
    if (!profile?.browser_in_use || loading || clearing || busyPollsRemaining.current <= 0) return;
    const timer = window.setTimeout(() => {
      busyPollsRemaining.current -= 1;
      void refresh(true, true);
    }, 2000);
    return () => { window.clearTimeout(timer); };
  }, [profile, loading, clearing, refresh, sessionKey]);

  async function clearSavedData() {
    if (!profile?.can_clear || profile.browser_in_use || loading || clearing || actionPending) return;
    const id = ++requestId.current;
    setClearing(true); setError(''); setNotice('');
    try {
      const result = await post<BrowserProfileStatus>(`/browser-profiles/${platform}/clear`);
      if (id === requestId.current) {
        setProfile(result);
        setNotice('已清除该平台保存的浏览器数据。下次需要时请在官网重新登录。');
      }
    } catch (failure) {
      if (id === requestId.current) {
        setError((failure as Error).message);
        await refresh(true);
      }
    } finally {
      setClearing(false);
    }
  }

  const enabled = profile?.persistence_enabled ?? persistenceEnabled;
  return (
    <section className="browser-session-state" aria-labelledby={`browser-session-${platform}`}>
      <div className="browser-session-heading"><h4 id={`browser-session-${platform}`}>{platformNames[platform]} 浏览器会话</h4><button type="button" className="icon-button" aria-label="刷新浏览器会话状态" onClick={() => void refresh()} disabled={loading || clearing}><Icon name="refresh" size={14} /></button></div>
      <p className="browser-session-mode">{enabled ? '自动保留已开启' : '自动保留未开启'}</p>
      <p>{enabled ? '下次打开同平台时，自动复用 TicketPilot 在后端机器上的专用浏览器数据，无需手动保存。' : '当前使用临时浏览器，不会复用之前保存的数据。'}</p>
      {loading ? <p role="status">正在读取浏览器会话状态…</p> : profile && <>
        <p className="browser-session-status">{profile.saved_data_present ? '已保存浏览器数据' : '暂无已保存的浏览器数据'} · 登录未验证</p>
        <p>保存的数据不代表已登录，是否仍有效请以官网页面为准。</p>
        {profile.browser_in_use && <p>浏览器使用中，结束会话后可清除数据。</p>}
      </>}
      {error && <p className="browser-session-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button type="button" className="text-button" disabled={!profile?.can_clear || profile.browser_in_use || loading || clearing || actionPending} onClick={() => void clearSavedData()}>{clearing ? '正在清除…' : '清除保存的浏览器数据'}</button>
    </section>
  );
}
