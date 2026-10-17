import { useEffect, useState } from 'react';
import { Icon } from './components';
import { calculateTargetBudget, REFERENCE_URL, saleCountdown, TARGET_PRICES, TARGET_SALE_AT, TARGET_URL } from './ticketPlanning';
import { describeSeatPreference, recommendTier, type TierAvailability } from './recommendation';

type Activity = 'target' | 'reference';
const formatAmount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

function SaleCountdown() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const countdown = saleCountdown(now);
  return <div className="sale-countdown">
    <span className="planning-kicker">距离计划开售 · 本地倒计时</span>
    {countdown.seconds > 0 ? <div role="timer" aria-label="距离计划开售" className="countdown-digits">{[
      [countdown.days, '天'], [countdown.hours, '时'], [countdown.minutes, '分'], [countdown.remainingSeconds, '秒'],
    ].map(([value, label]) => <span key={label}><strong>{String(value).padStart(2, '0')}</strong><small>{label}</small></span>)}</div>
      : <p className="sale-time-reached" role="status">已到计划开售时间，请以官网状态为准</p>}
    <p>时钟来源：本机时间，未与官网校时。归零仅提示时间，不查询库存或自动打开官网。</p>
    <p className="sale-conflict">按官方正文 11:00 GMT+7 计算；座区海报写 11:00 PM，与正文冲突，请复核官网最新开售状态。</p>
  </div>;
}

function TargetPreferences() {
  const [quantity, setQuantity] = useState('1');
  const price = 2500;
  const [quantityEdited, setQuantityEdited] = useState(false);
  const [budget, setBudget] = useState('');
  const [adjacent, setAdjacent] = useState('prefer');
  const [position, setPosition] = useState<'center' | 'aisle' | 'either'>('either');
  const [availability, setAvailability] = useState<Partial<Record<number, TierAvailability>>>({});
  const lowerPrices = TARGET_PRICES.filter((tier) => tier < price);
  const validQuantity = Number.isInteger(Number(quantity)) && Number(quantity) >= 1 && Number(quantity) <= 4;
  const recommendation = validQuantity ? recommendTier([price, ...lowerPrices], availability, Number(quantity)) : null;
  const estimate = calculateTargetBudget(Number(quantity), recommendation?.nextTier?.price ?? price, budget);
  const allUnavailable = recommendation?.status === 'all_unavailable';
  return <section className="preference-section" aria-labelledby="preference-heading">
    <div className="planning-section-heading"><h4 id="preference-heading">目标活动 · 购票偏好</h4><span>仅保留在当前页面</span></div>
    <p className="planning-copy">已按你的偏好设为最高档优先，无合适座位再降一档；座位靠中或靠过道。具体可售座位由官网核对。</p>
    <div className="preference-grid">
      <div><label className="field-label" htmlFor="ticket-quantity">票数 <span>1–4 张</span></label><input id="ticket-quantity" type="number" min="1" max="4" step="1" value={quantity} onChange={(event) => { setQuantity(event.target.value); setQuantityEdited(true); setAvailability({}); }} aria-invalid={!estimate.validQuantity} aria-describedby="quantity-help" /><p className={`preference-help ${!estimate.validQuantity ? 'planning-error' : ''}`} id="quantity-help">{estimate.validQuantity ? `${quantityEdited ? '此票数仅为本地计划' : '初值 1 张待你确认，可直接修改'}；每单最多 4 张，禁止重复购买。` : '请输入 1–4 之间的整数张数。'}</p></div>
      <div><label className="field-label" htmlFor="ticket-budget">总预算 <span>THB · 选填</span></label><input id="ticket-budget" type="text" inputMode="decimal" autoComplete="off" placeholder="输入可接受的总额" value={budget} onChange={(event) => setBudget(event.target.value)} aria-invalid={estimate.budgetState === 'invalid'} aria-describedby="budget-help" /><p className="preference-help" id="budget-help">仅比较票面与服务费；还需预留支付渠道费用。</p></div>
      <div><label className="field-label" htmlFor="seat-position">座位位置偏好</label><select id="seat-position" value={position} onChange={(event) => { setPosition(event.target.value as 'center' | 'aisle' | 'either'); setAvailability({}); }}><option value="either">靠中或靠过道</option><option value="center">优先靠中</option><option value="aisle">优先靠过道</option></select></div>
      <div className="preference-wide"><label className="field-label" htmlFor="adjacent-seats">多人连座偏好</label><select id="adjacent-seats" value={adjacent} onChange={(event) => { setAdjacent(event.target.value); setAvailability({}); }}><option value="prefer">尽量连座</option><option value="required">必须连座，否则重新选择</option><option value="any">可接受分开坐</option></select></div>
    </div>
    <p className="tier-order"><span>票档降级顺序</span><strong>{[price, ...lowerPrices].map(formatAmount).join(' → ')} THB</strong></p>
    {estimate.validQuantity && <p className="planning-copy">{describeSeatPreference(position, Number(quantity))}</p>}
    <div className="budget-summary" role="region" aria-label="预算核对" aria-live="polite">
      {allUnavailable ? <p>全部票档均被你标记为无合适票，当前没有待核对档；人工记录不代表实时售罄。</p> : estimate.knownSubtotal === null ? <p className="planning-error">请先修正票数或票档，再计算已知小计。</p> : <><div className="budget-total"><span>待核对档已知小计（{formatAmount(recommendation!.nextTier!.price)} THB）</span><strong>{formatAmount(estimate.knownSubtotal)} <small>THB</small></strong></div><p>票面 {formatAmount(estimate.ticketSubtotal!)} + 服务费 {formatAmount(estimate.serviceFee!)}（30/张），未含支付费。</p></>}
      {estimate.budgetState === 'invalid' && <p className="planning-error">总预算须为大于 0 的金额，最多 2 位小数。</p>}
      {!allUnavailable && estimate.knownSubtotal !== null && estimate.budgetState === 'exceeded' && <p className="planning-error">已知小计已超出预算，请核对票数或预算；超预算不代表该档无票。</p>}
      {!allUnavailable && estimate.knownSubtotal !== null && estimate.budgetState === 'withinKnownSubtotal' && <p>已知小计在预算内；加上支付费后是否仍在预算内，须以官网总额复核。</p>}
      <p className="payment-rate-note">官网公布费率：信用卡 3.25% · Thai QR 1.5% · TrueMoney / Alipay / WeChat 3%。计费基数未核实，因此不估算最终应付金额。</p>
    </div>
    <details className="planning-details manual-tier-details"><summary>逐档人工记录与座区参考</summary><p className="planning-copy">只在官网实际核对后更新；这里不是实时库存，也不会选择座位。状态未知时先核实该档，仅在你标记无合适票后提示下一档。更改票数或座位偏好会清空记录。</p>
      <div className="manual-tier-grid">{[price, ...lowerPrices].map((tier) => <div key={tier}><label className="field-label" htmlFor={`tier-status-${tier}`}>{formatAmount(tier)} THB · 人工记录</label><select id={`tier-status-${tier}`} value={availability[tier] ?? 'unknown'} onChange={(event) => setAvailability((previous) => ({ ...previous, [tier]: event.target.value as TierAvailability }))}><option value="unknown">待官网核实</option><option value="available">人工看到合适票，需再次核实</option><option value="unavailable">人工核对无合适票</option></select></div>)}</div>
      {recommendation && <p className="tier-recommendation" aria-live="polite">{recommendation.nextTier ? `下一步核对 ${formatAmount(recommendation.nextTier.price)} THB。` : ''}{recommendation.explanation}</p>}
      <ul className="planning-rules"><li>2,500 THB：A1 / A2 位于屏幕近侧，优先看靠中央空隙一侧。</li><li>2,000 THB：先看中央 B2，再看 B1 / B3 靠中位置。</li><li>1,500 THB：看 C1 / C2 靠中位置。</li><li>900 THB：D1–D4 在 2nd floor，先看靠中的 D2 / D3。</li></ul><p className="planning-copy">座区参考来自 2026-10-17 查看过的官方座区图。图中空隙不等于已确认过道；具体排号、座号、连座及库存须在官网核实，未取得实时销量或热度数据。</p><a className="text-button" href="https://atkmedia.allticket.com/images/up/26144/141026LenamiuFinal_Planzone_Poster.jpg" target="_blank" rel="noopener noreferrer">查看官方座区及权益图</a>
    </details>
  </section>;
}

function PurchaseChecklist({ activity }: { activity: Activity }) {
  const [checked, setChecked] = useState<string[]>([]);
  const target = activity === 'target';
  const steps = [
    { id: 'login', title: '登录与验证', detail: '在官网人工登录，按官网提示完成验证码和排队；复核最新公告。' },
    { id: 'show', title: '场次与票档', detail: target ? '核对 2026-10-30 18:30 GMT+7 场次、票数与票档，不把演出时间当成开售时间。' : '核对本参考活动 2026-11-22 15:00 GMT+7 场次、独立票价与购票资格。' },
    { id: 'seats', title: '选座', detail: '在官网自行核对区域、排号、座号及连座。选中样式不能证明已锁票。' },
    { id: 'confirm', title: '官网确认', detail: '阅读条款与保险选项，再在官网核对并确认；时限以官网显示为准。' },
    { id: 'payment', title: '支付页核对', detail: '核对活动、座位、票数、票面、各项费用、最终总额及支付期限。' },
    { id: 'result', title: '官网付款结果', detail: target ? '付款由你在官网完成，以官网订单及支付结果为准，自行保管凭证。' : '自行核对官方付款结果；参考公告要求付款后 1 小时内完成观众登记，须复核官方入口及最新规则。' },
    { id: 'pickup', title: '取票与入场', detail: target ? '复核演出日现场取票要求，备妥付款证明及同名身份证或护照原件；代取需额外材料。' : '逐人复核实名登记、证件与入场要求；不要套用目标活动的取票规则。' },
  ];
  return <details className="planning-details checklist-details">
    <summary>逐步购票核对 <span>{checked.length}/{steps.length} 人工已核对</span></summary>
    <p className="planning-copy">勾选仅记录你的人工核对，不代表平台验证、锁票或付款成功。切换活动或刷新页面会清空。</p>
    <ol className="purchase-checklist">{steps.map((step, index) => <li key={step.id}><label><input type="checkbox" aria-label={`${step.title}：人工已核对`} checked={checked.includes(step.id)} onChange={(event) => setChecked((previous) => event.target.checked ? [...previous, step.id] : previous.filter((id) => id !== step.id))} /><span><strong>{index + 1}. {step.title}</strong><small>{step.detail}</small><em>{checked.includes(step.id) ? '人工已核对' : '待人工核对'}</em></span></label></li>)}</ol>
    <button className="text-button" onClick={() => setChecked([])} disabled={checked.length === 0}>重置人工核对</button>
  </details>;
}

function ActivityPlan({ activity }: { activity: Activity }) {
  const target = activity === 'target';
  return <div className="activity-plan">
    <div className="activity-overview">
      <div className="activity-description"><span className="planning-kicker">{target ? '目标活动 / 购票准备' : '参考活动 / 独立流程核对'}</span><h4>{target ? 'Pls Love · Final EP Fan Moment' : 'LENA & MIU · Girls Night Out Birthday Party'}</h4>
        {target ? <><p className="sale-date">计划开售 <time dateTime={TARGET_SALE_AT}>2026-10-18</time></p><p className="sale-timezones"><strong>北京 12:00</strong><span>Asia/Shanghai</span><strong>泰国 11:00</strong><span>Asia/Bangkok · GMT+7</span></p><p className="planning-copy">官网公告：网上与 7-Eleven Counter Service 同时开放所有座位。实际售票状态以官网为准。</p></>
          : <p className="planning-copy">官方公告一般销售自 2026-10-03 13:00 GMT+7 开始。此前观察到 BUY NOW 按钮，当前库存及完整购买流程仍待人工验证。</p>}
        <a className="button primary official-link" href={target ? TARGET_URL : REFERENCE_URL} target="_blank" rel="noopener noreferrer">{target ? '打开目标活动官网' : '打开参考活动官网'}<Icon name="external" size={15} /></a>
      </div>
      {target ? <SaleCountdown /> : <div className="reference-caution"><strong>参考规则仅适用于此活动</strong><p>2026-10-03 的 Thai ID 阶段：10:00–12:00 GMT+7，仅限柜台及指定座位。</p><p>付款后 1 小时内逐人登记姓名、证件匹配等要求须复核最新公告，不用于目标活动。</p></div>}
    </div>
    <p className="planning-source">来源：2026-10-17（北京时间）{target ? '已读取公开正文及目标座区海报' : '读取的本参考活动官方公开正文'}，实时选座及付款未验证。购票前请点击上方官网链接复核最新完整规则。</p>
    {target ? <TargetPreferences /> : <div className="reference-facts"><p>参考活动也按最高档优先逐档核对：5,900 → 4,900 → 3,900 → 2,900 → 1,900 THB；每张另加塑料票 20 THB、服务费 30 THB。未核实库存前，不推定应降档。</p><p>参考限购：每次交易及每位身份证/护照持有人最多 4 张，每张需不同观众姓名。这里不使用目标活动的票档、人工记录或费用计算。</p></div>}
    <details className="planning-details"><summary>{target ? '目标活动详细规则与待核实事项' : '参考活动详细规则与待核实事项'}</summary><ul className="planning-rules">
      {target ? <><li>每单最多 4 张且禁止重复购买；区域和连座以实际页面为准。</li><li>选 7-Eleven 现金付款码时，须在 30 分钟内付款。该期限不代表锁票时长；其他支付方式期限待核实。</li><li>付款后不可换座、取消或退款，不允许修改、转让。演出日现场取票，需付款证明和同名证件原件；代取需另备授权及证件材料。</li><li>目标公告未列 Thai ID 专场，也未见参考活动的付款后 1 小时观众登记要求。</li></> : <><li>Thai ID 柜台阶段与一般销售是此参考活动独立安排，不可套用到其他活动。</li><li>参考公告要求付款后 1 小时内通过官方短信入口登记全部观众，姓名不能重复或提交后修改；入场须与原始证件匹配，最新细节请复核。</li></>}
      <li>登录、验证码、排队、刷新规则、选座超时、锁票节点、实时库存与境外支付可用性仍待实际核实。</li>
    </ul></details>
    <PurchaseChecklist activity={activity} />
  </div>;
}

export default function TicketAssistant() {
  const [activity, setActivity] = useState<Activity>('target');
  return <section className="panel ticket-assistant" aria-labelledby="ticket-assistant-heading">
    <div className="assistant-heading"><div><div className="eyebrow">TICKET PREPARATION</div><h3 id="ticket-assistant-heading">开售准备与购票核对</h3></div><div className="activity-switch" role="group" aria-label="购票准备活动"><button type="button" aria-pressed={activity === 'target'} onClick={() => setActivity('target')}>目标购票准备</button><button type="button" aria-pressed={activity === 'reference'} onClick={() => setActivity('reference')}>参考流程核对</button></div></div>
    <ActivityPlan key={activity} activity={activity} />
  </section>;
}
