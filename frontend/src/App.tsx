import { useState, type FormEvent } from 'react';
import { validateActivityUrl } from './api';
import { useResearch } from './useResearch';
import { Icon, StatusBadge, duration, formatTime, kindNames, markerDetails, pageNames, platformNames } from './components';
import type { Observation, Platform } from './types';
import TicketAssistant from './TicketAssistant';
import BrowserSessionState from './BrowserSessionState';

export default function App() {
  const research = useResearch();
  const { config, sessions, selectedId, current, liveSession, events, initialLoading, eventsLoading, connectionError, actionError, notice, pending, cooldownSeconds } = research;
  const [platform, setPlatform] = useState<Platform>('allticket');
  const [url, setUrl] = useState('');
  const [eventName, setEventName] = useState('');
  const [formError, setFormError] = useState('');
  const observationEvent = events.filter((event) => ['page_observation', 'page_loaded'].includes(event.kind)).at(-1);
  const observation = observationEvent?.data as Observation | undefined;
  const hasBrowser = config?.browser_mode === 'headed' && config.display_available;

  function launch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateActivityUrl(url, platform);
    setFormError(validation ?? '');
    if (!validation) void research.launch(platform, url, eventName);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="TicketPilot 首页"><span className="brand-mark"><Icon name="activity" size={23} /></span><h1>TicketPilot<span className="brand-period" aria-hidden="true">.</span></h1></a>
        <div className="workspace-label">RESEARCH WORKSPACE <span>MVP 0.1</span></div>
        <span className={`connection ${connectionError ? 'offline' : ''}`}><i />{initialLoading ? '连接中' : connectionError ? '后端未连接' : '本地服务已连接'}</span>
      </header>

      <main>
        <div className="page-heading">
          <div><div className="eyebrow">BROWSER RESEARCH</div><h2>把每一次观察，变成证据。</h2><p>打开官方活动页面，手动操作，记录真实的页面状态与耗时。</p></div>
          <div className="platform-priority"><span className="priority-dot" /><div><strong>ALL TICKET 优先</strong><span>独立适配 · TTM 同步研究</span></div></div>
        </div>

        <TicketAssistant />

        {connectionError && <div className="notice error" role="alert"><span>{connectionError}</span><button className="text-button" onClick={() => void research.loadWorkspace()}>重新连接</button></div>}
        {actionError && <div className="notice error" role="alert"><span>{actionError}</span><button className="icon-button" aria-label="关闭错误提示" onClick={research.dismissError}><Icon name="close" size={16} /></button></div>}
        <div className={`notice success ${notice ? '' : 'visually-hidden'}`} role="status">{notice}</div>

        <div className="research-grid">
          <aside className="sidebar">
            <section className="panel launch-panel" aria-labelledby="new-research-heading">
              <div className="panel-heading"><h3 id="new-research-heading">新建研究</h3><span className="small-number">01</span></div>
              <form onSubmit={launch} noValidate>
                <fieldset className="platform-options"><legend>票务平台</legend>{(['allticket', 'ttm'] as Platform[]).map((id) => <label key={id} className={`platform-option ${platform === id ? 'chosen' : ''}`}><input type="radio" name="platform" value={id} checked={platform === id} onChange={() => { setPlatform(id); setFormError(''); }} /><span>{id === 'allticket' ? 'ALL TICKET' : 'TTM'}{id === 'allticket' && <small>首选</small>}</span></label>)}</fieldset>
                <label className="field-label" htmlFor="activity-url">活动 URL <span>必填</span></label>
                <input id="activity-url" type="url" inputMode="url" autoComplete="off" placeholder={platform === 'allticket' ? 'https://www.allticket.com/event/…' : 'https://www.thaiticketmajor.com/…'} value={url} onChange={(event) => { setUrl(event.target.value); setFormError(''); }} aria-invalid={Boolean(formError)} aria-describedby={formError ? 'url-error' : 'url-help'} />
                {formError ? <p className="field-error" id="url-error">{formError}</p> : <p className="field-help" id="url-help">粘贴官方活动链接，以此开始一次观察。</p>}
                {platform === 'allticket' && <div className="url-presets"><span>快捷填入</span><button type="button" onClick={() => { setUrl('https://www.allticket.com/event/PlsLoveFanScreeningFinalEP'); setEventName('Pls Love Fan Screening Final EP'); setFormError(''); }}>目标活动</button><button type="button" onClick={() => { setUrl('https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty'); setEventName('LENA MIU Girls Night Out BD Party'); setFormError(''); }}>参考活动</button></div>}
                <label className="field-label" htmlFor="event-name">研究名称 <span>选填</span></label>
                <input id="event-name" maxLength={120} autoComplete="off" placeholder="例如：周末演出 · 首次观察" value={eventName} onChange={(event) => setEventName(event.target.value)} />
                <p className="field-help">请勿填写姓名、账号或其他个人信息。</p>
                {config && <BrowserSessionState key={platform} platform={platform} persistenceEnabled={config.persistent_browser_session} sessionKey={`${liveSession?.id ?? ''}:${liveSession?.status ?? ''}`} actionPending={Boolean(pending)} />}
                <button className="button primary launch-button" type="submit" disabled={Boolean(pending || liveSession || !hasBrowser || connectionError)}>{pending === 'launch' ? '正在打开浏览器…' : '打开研究浏览器'}<Icon name="arrow" size={18} /></button>
                {liveSession && <p className="field-help active-hint">已有进行中的会话，请先结束后再新建。</p>}
                {config && !hasBrowser && <p className="environment-hint" role="note">{config.browser_mode === 'headless' ? '当前为无头测试模式，无法手动登录。请使用有桌面的环境，以 headed 模式启动后端。' : '后端未检测到桌面显示。请在本地桌面运行后端，或连接云桌面后再启动。'}</p>}
              </form>
            </section>

            <section className="manual-guide" aria-labelledby="manual-guide-heading">
              <span className="guide-icon"><Icon name="eye" size={21} /></span><h3 id="manual-guide-heading">你来操作，工具来记录</h3>
              <ol><li>浏览器在<strong>运行后端的机器</strong>打开；云端使用时需连接该机器的桌面。</li><li>在官方页面查看登录状态，按需登录并完成平台验证或排队。</li><li>回到这里记录页面，或为已发生的操作添加时间标记。</li></ol>
              <p>记录按钮只采集页面或标记时间，不选择座位、不确认订单。</p>
            </section>

            <section className="panel history-panel" aria-labelledby="history-heading">
              <div className="panel-heading"><h3 id="history-heading">研究历史 <span className="count">{sessions.length}</span></h3><button className="icon-button" aria-label="刷新研究历史" onClick={() => void research.loadWorkspace()} disabled={Boolean(pending)}><Icon name="refresh" size={16} /></button></div>
              {initialLoading ? <p className="muted history-empty">正在读取研究记录…</p> : !sessions.length ? <p className="muted history-empty">第一份研究记录，从一个活动链接开始。</p> : <ul className="session-list">{sessions.map((session) => <li key={session.id}><button className={`session-item ${selectedId === session.id ? 'selected' : ''}`} aria-pressed={selectedId === session.id} disabled={Boolean(pending)} onClick={() => research.selectSession(session.id)}><div><span className="session-platform">{platformNames[session.platform]}</span><StatusBadge session={session} /></div><strong>{session.event_name || '未命名活动研究'}</strong><time dateTime={session.started_at}>{formatTime(session.started_at)}</time></button></li>)}</ul>}
            </section>
          </aside>

          <div className="workspace-main">
            <section className="panel session-panel" aria-labelledby="session-heading">
              <div className="panel-heading"><h3 id="session-heading">当前研究会话</h3>{current ? <StatusBadge session={current} /> : <span className="subtle-tag">等待开始</span>}</div>
              {!current ? <div className="empty-session"><div className="empty-illustration"><span className="mini-browser"><i /><i /><i /><span><Icon name="activity" size={34} /></span></span><span className="illustration-dot" /></div><h4>从真实页面开始，保留每一条证据</h4><p>在左侧输入活动链接，打开独立浏览器。<br />活动信息、页面耗时和观察记录将在这里显示。</p><span className="empty-footnote">人工登录 · 可见状态观察 · 脱敏日志</span></div> : <>
                <div className="session-summary"><span className="session-kicker">{platformNames[current.platform]} / RESEARCH SESSION</span><h4>{current.event_name || '未命名活动研究'}</h4><p className="session-url"><Icon name="external" size={14} /><span>{current.url}</span></p><div className="session-meta"><span><Icon name="clock" size={14} />{formatTime(current.started_at)} 开始</span><code>#{current.id.slice(0, 8)}</code></div></div>
                {current.error && <div className="session-error" role="alert">{current.error}</div>}
                {current.status === 'opening' && <div className="session-instruction"><span className="pulse-dot" />正在打开页面，请稍候。加载失败也会保留诊断记录。</div>}
                {current.status === 'active' && <div className="session-instruction"><Icon name="eye" size={18} />请在独立浏览器查看登录状态，按需完成登录。准备好后，记录当前页面。</div>}
                <div className="session-actions"><button className="button primary" disabled={Boolean(pending || current.status !== 'active' || cooldownSeconds)} onClick={() => void research.record('capture')}><Icon name="plus" size={17} />{pending === 'capture' ? '正在记录…' : cooldownSeconds ? `${cooldownSeconds} 秒后可再次记录` : '记录当前页面'}</button><button className="button secondary" disabled={Boolean(pending)} onClick={() => void research.exportSession()}><Icon name="download" size={16} />{pending === 'export' ? '正在导出…' : '导出脱敏 JSON'}</button>{['active', 'opening'].includes(current.status) && <button className="text-button end-button" disabled={Boolean(pending)} onClick={() => void research.closeSession()}>{pending === 'close' ? '正在结束…' : '结束会话'}</button>}</div>
              </>}
            </section>

            <section className="observation-section" aria-labelledby="observation-heading">
              <div className="section-heading"><h3 id="observation-heading">页面观察</h3><span>{observationEvent ? `最近记录 ${formatTime(observationEvent.created_at)}` : '记录后显示真实测量值'}</span></div>
              <div className="metrics-grid"><div className="metric-card"><span>DOM 就绪</span><strong>{duration(observation?.timing?.dom_content_loaded_ms)}</strong><small>页面导航 → DOMContentLoaded</small></div><div className="metric-card"><span>页面加载</span><strong>{duration(observation?.timing?.load_ms)}</strong><small>页面导航 → load</small></div><div className="metric-card"><span>响应完成</span><strong>{duration(observation?.timing?.response_ms)}</strong><small>页面导航 → responseEnd</small></div></div>
              <div className="panel state-panel"><div className="page-state"><span className="state-icon"><Icon name="eye" size={20} /></span><div><span className="field-label">当前页面</span><strong>{observation ? pageNames[observation.page_type ?? 'unknown'] ?? '未知页面' : '等待页面观察'}</strong><p>{observation ? '通用页面特征仅供研究参考，平台结构仍需人工验证。' : '不会根据未验证的页面结构推断活动或座位状态。'}</p></div></div><div className="seat-state"><span>座位状态</span><strong>尚未验证</strong><small>未建立平台专属识别规则</small></div></div>
              {observation?.visible_counts && <div className="visible-counts"><span>可见元素</span>{Object.entries(observation.visible_counts).map(([key, value]) => <span key={key}>{({ buttons: '按钮', links: '链接', inputs: '输入框', images: '图片', frames: '框架' } as Record<string, string>)[key] ?? key}<b>{value}</b></span>)}</div>}
            </section>

            <section className="panel markers-panel" aria-labelledby="markers-heading"><div className="panel-heading"><h3 id="markers-heading">人工时间标记</h3><span className="subtle-tag">仅记录时间</span></div><p className="panel-description">在官网完成对应操作后，点此记录。标记不代表座位已被锁定。</p><div className="marker-grid">{Object.entries(markerDetails).map(([label, detail]) => <button key={label} aria-label={`${label} ${detail.label}：记录时间`} className="marker-button" disabled={Boolean(pending || current?.status !== 'active')} onClick={() => void research.record(label as 'T1' | 'T2' | 'T3')}><span className="marker-label">{label}</span><strong>{detail.label}</strong><small>{detail.description}</small><span className="marker-action">{pending === label ? '正在记录…' : '记录时间'} <Icon name="plus" size={13} /></span></button>)}</div></section>

            <section className="panel timeline-panel" aria-labelledby="timeline-heading"><div className="panel-heading"><h3 id="timeline-heading">观察日志 <span className="count">{events.length}</span></h3><span className="log-note"><i />脱敏记录</span></div><p className="panel-description">只保存结构化观察信息。账号密码、Cookie、Token 和页面原文不会写入研究记录。</p>{eventsLoading ? <p className="log-empty">正在读取日志…</p> : !events.length ? <div className="log-empty"><Icon name="activity" size={23} /><span>尚无观察日志</span><small>创建会话并记录页面后，时间线将在这里展开。</small></div> : <ol className="event-list">{[...events].reverse().map((event) => <li key={event.id}><span className={`event-dot ${event.kind === 'manual_marker' ? 'marker-dot' : ''}`} /><div className="event-body"><div className="event-line"><strong>{kindNames[event.kind] ?? '研究事件'}{event.kind === 'manual_marker' && typeof event.data.label === 'string' ? ` · ${event.data.label}` : ''}</strong><time dateTime={event.created_at}>{formatTime(event.created_at)}</time></div><details><summary>查看结构化记录</summary><pre>{JSON.stringify(event.data, null, 2)}</pre></details></div></li>)}</ol>}</section>
          </div>
        </div>
        <footer><span>TicketPilot / 观察先于假设</span><span>本地研究记录 · 官方流程由你掌控</span></footer>
      </main>
    </div>
  );
}
