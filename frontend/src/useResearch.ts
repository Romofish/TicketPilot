import { useCallback, useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import type { ResearchConfig, ResearchEvent, Session, Platform } from './types';

export function useResearch() {
  const [config, setConfig] = useState<ResearchConfig | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const current = sessions.find((session) => session.id === selectedId);
  const liveSession = sessions.find((session) => ['active', 'opening'].includes(session.status));
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const loadWorkspace = useCallback(async () => {
    try {
      const [nextConfig, result] = await Promise.all([
        api<ResearchConfig>('/config'), api<{ sessions: Session[] }>('/research/sessions'),
      ]);
      setConfig(nextConfig);
      setSessions(result.sessions);
      setSelectedId((previous) => previous ?? result.sessions.find((session) => ['active', 'opening'].includes(session.status))?.id ?? result.sessions[0]?.id ?? null);
      setConnectionError('');
    } catch (error) { setConnectionError((error as Error).message); }
    finally { setInitialLoading(false); }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    if (!selectedId) return;
    setEventsLoading(true);
    void api<{ events: ResearchEvent[] }>(`/research/sessions/${selectedId}/events`)
      .then((result) => { if (!cancelled) setEvents(result.events); })
      .catch((error: Error) => { if (!cancelled) setActionError(error.message); })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (!liveSession) return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      const requestedId = selectedRef.current;
      try {
        const [result, eventResult] = await Promise.all([
          api<{ sessions: Session[] }>('/research/sessions'),
          requestedId ? api<{ events: ResearchEvent[] }>(`/research/sessions/${requestedId}/events`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSessions(result.sessions);
        if (selectedRef.current === requestedId && eventResult) setEvents(eventResult.events);
        setConnectionError('');
      } catch (error) { if (!cancelled) setConnectionError((error as Error).message); }
      finally { inFlight = false; }
    };
    const interval = window.setInterval(() => { void poll(); }, 2000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [liveSession?.id]);

  useEffect(() => {
    if (!cooldownUntil || now >= cooldownUntil) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [cooldownUntil, now >= cooldownUntil]);

  async function launch(platform: Platform, url: string, eventName: string) {
    setPending('launch'); setActionError(''); setNotice('');
    try {
      const session = await post<Session>('/research/sessions', { platform, url: url.trim(), ...(eventName.trim() ? { event_name: eventName.trim() } : {}) });
      setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)]);
      setSelectedId(session.id);
      setNotice('研究会话已创建。请在后端所在机器的浏览器中查看登录状态，按需完成登录。');
    } catch (error) { setActionError((error as Error).message); }
    finally { setPending(null); }
  }

  async function record(action: 'capture' | 'T1' | 'T2' | 'T3') {
    if (!current) return;
    const sessionId = current.id;
    setPending(action); setActionError(''); setNotice('');
    try {
      const result = action === 'capture'
        ? await post<ResearchEvent>(`/research/sessions/${sessionId}/capture`)
        : await post<ResearchEvent>(`/research/sessions/${sessionId}/markers`, { label: action });
      if (selectedRef.current === sessionId) setEvents((previous) => [...previous.filter((item) => item.id !== result.id), result]);
      if (action === 'capture') {
        const timestamp = Date.now();
        setNow(timestamp); setCooldownUntil(timestamp + (config?.capture_cooldown_seconds ?? 3) * 1000);
      }
      setNotice(action === 'capture' ? '已记录当前可见页面。' : `${action} 人工观察时间已记录。`);
    } catch (error) { setActionError((error as Error).message); }
    finally { setPending(null); }
  }

  async function closeSession() {
    if (!current) return;
    setPending('close'); setActionError(''); setNotice('');
    try {
      const result = await post<Session>(`/research/sessions/${current.id}/close`);
      setSessions((previous) => previous.map((session) => session.id === result.id ? result : session));
      const eventResult = await api<{ events: ResearchEvent[] }>(`/research/sessions/${current.id}/events`);
      if (selectedRef.current === current.id) setEvents(eventResult.events);
      setNotice('研究会话已结束，观察记录已保留。');
    } catch (error) { setActionError((error as Error).message); }
    finally { setPending(null); }
  }

  async function exportSession() {
    if (!current) return;
    setPending('export'); setActionError('');
    try {
      const result = await api<unknown>(`/research/sessions/${current.id}/export`);
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = objectUrl; link.download = `ticketpilot-${current.platform}-${current.id}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice('脱敏 JSON 已导出。');
    } catch (error) { setActionError((error as Error).message); }
    finally { setPending(null); }
  }

  function selectSession(id: string) { setSelectedId(id); setActionError(''); setNotice(''); }

  return {
    config, sessions, selectedId, events, initialLoading, eventsLoading, connectionError,
    actionError, notice, pending, current, liveSession, cooldownSeconds,
    loadWorkspace, launch, record, closeSession, exportSession, selectSession,
    dismissError: () => setActionError(''),
  };
}
