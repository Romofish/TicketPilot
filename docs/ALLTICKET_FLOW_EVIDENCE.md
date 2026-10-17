# ALL TICKET 公开流程与开售证据

初次取证日期：2026-10-17，Asia/Shanghai。公开网络读取发生于 **14:53–14:57**。下方原始研究覆盖公开活动内容及前端脚本；文末追加了 2026-10-18 的真实云浏览器观察。参考活动实际点击 BUY NOW 后仍弹登录框，没有进入选座、占位、订单或付款，不能声称已走完真实购票流程。

## 来源、方法与访问结果

保留环境代理与 TLS 校验；通过命令级 network 权限读取。运行环境状态为 `observations_current=true`、网络策略 `enforced`。公开 JSON、HTML、JS 仅在进程内分析，没有保存原始响应、整页 HTML、登录态或截图。仅将不含个人资料的官方公开座区海报下载到临时目录供视觉检查；它是宣传资料，不是用户会话截图。

| 编号 | 官方来源 | 取证时间（北京时间）与结果 | 适用范围 |
| --- | --- | --- | --- |
| F01 | [目标活动](https://www.allticket.com/event/PlsLoveFanScreeningFinalEP)；[该页读取的公开活动 JSON](https://www.allticket.com/master/event_info/PlsLoveFanScreeningFinalEP.json) | 14:54:51，JSON HTTP 200 | 目标活动 ID `26144` 的标题、演出日期、票价、公告正文及海报引用 |
| F02 | [参考活动](https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty)；[公开活动 JSON](https://www.allticket.com/master/event_info/LENAMIUGirlsNightOutBDParty.json) | 14:55:59，JSON HTTP 200 | 参考活动 ID `26143`；不能据此推断库存或付款可用性 |
| F03 | [main.fa1701f1f246da362115.js](https://www.allticket.com/main.fa1701f1f246da362115.js) | 14:53–14:54，HTTP 200；SHA-256 `f248372753f50a60bf93fb358d9d721212877874b38571dfd3a46d5366f70b6f` | 本版本详情页、按钮、登录分支及服务方法的静态代码 |
| F04 | [runtime.12f24a167315911191c8.js](https://www.allticket.com/runtime.12f24a167315911191c8.js)；[scripts.f916c9290eedf1b45c52.js](https://www.allticket.com/scripts.f916c9290eedf1b45c52.js) | 14:55–14:56，HTTP 200 | runtime 确证 booking lazy chunk 文件名；没有猜测 chunk URL |
| F05 | [booking-booking-module-ngfactory.4e2881de93d8d96c4250.js](https://www.allticket.com/booking-booking-module-ngfactory.4e2881de93d8d96c4250.js) | 14:56:32，HTTP 200；SHA-256 `edeede8b12d5d788a12c6019eefb9d097bd8364c47482db697246869b1b0cb43` | 本版本的选择、预订、付款及会话计时分支；没有执行 |
| F06 | [官方座区及福利海报](https://atkmedia.allticket.com/images/up/26144/141026LenamiuFinal_Planzone_Poster.jpg) | 14:55:06，HTTP 200；已视觉检查 | 目标活动分区示意、票档、福利及图片内时间文字；不含座号和实时库存 |
| F07 | [官方详情状态入口](https://www.allticket.com/api-content/check-event) | 14:56 左右，两个活动各一次只读 POST，均 HTTP 403 | 请求仅包含官网代码所示 `performId`、`cached:true`，未发送账号/登录数据；未获得可售状态、开售时间或库存 |

F07 是前端 `getEventStatus()` 的公开状态读取入口，HTTP 方法为 POST。403 后未重试，也未绕过限制。本次只保留了状态码，没有足够的非敏感诊断信息区分代理策略、源站或 WAF；**不能确定拒绝层级，也不能归因为缺少域名、平台封号或售罄**。其他公开资源的 200 不代表该状态请求或登录流程一定可用。

## 开售时间：正文与海报存在冲突

F01 本次实际读取的正文有：

> Tickets on Sale: Sunday, 18 October 2026
>
> From 11:00 AM (GMT+7) onwards

泰文同段写 `11:00 น.(GMT+7)`。正文支持 **2026-10-18 泰国 11:00 / 北京 12:00 / UTC 04:00**，网上及 7-Eleven Counter Service 开售。

但 F06 海报底部写：

> TICKETS ON SALE : SUN, 18 OCTOBER 2026 | 11:00 PM ONWARDS

这是同一官方页面内相差 12 小时的 AM/PM 冲突，不能悄悄改为一致，也不能未经确认宣称一定是图片笔误。准备安排可按正文较早的时间进行，并在应用中明确标注“正文时间；海报 PM 冲突待复核”。F07 无法用于独立确认，最终实际开放状态仍以官方当天页面和正常购票流程为准。

## 开售按钮和所谓“倒计时”的已知边界

### 静态代码能说明什么

F03 在详情初始化后读取活动正文，再调用 `getEventStatus()`。服务方法与路径的短证据：

```javascript
gatewayMasterUrl: document.location.origin + "/api-content/"
getEventStatus: gatewayMasterUrl + "check-event"
this.http.post(EVENT_INFO_API.getEventStatus, {performId:l, cached:!0}, ...)
```

详情按钮使用服务端响应 `event_info` 的字段。以下为保留逻辑的短摘录，省略 UI 等无关部分：

```javascript
"Y" == l.isfull ? this.renderBuyTicketButton("full")
  : "Y" == l.isPromo ? this.renderBuyTicketButton("soon")
  : "N" == l.isPromo
    ? (this.renderBuyTicketButton("canBook"), this.canBooking = !0, this.retryCanbook())
    : ...
```

该分支另有 `masterPerform == "Y"`、演出未关闭等条件；参考子活动分支另有自己的事件处理，不应仅取一个字段作为所有活动的判定规则。标签为 `COMING SOON`、`BUY NOW`、`SOLD OUT` 等。

正常入口为 `buyTicket()`；`canBooking` 为真时才进入后续流程。它可能按服务端条件进入会员码、问答或普通场次路径。普通路径仍请求 `getRoundDetail`，只有 `success == 1`、`code == 100` 且有数据才导航到 `/booking/get-seat`；未授权错误通过站内消息触发登录。

`retryCanbook()` 含 `this.canBooking && this.retryBuyTicket` 时点击 BUY 按钮的重试恢复分支。它不是“计时到零自动抢购”的证据，不能将其单独解释成倒计时触发购买。

### 没有证实的部分

- 已检查 F03、F04、F05 及目标 F01 的详情内容，**未定位目标活动开售倒计时的具体实现**；没有足够证据回答它使用服务器校时还是设备时间、何时校时、归零是否重新获取状态。
- 目标公开详情正文没有内嵌开售倒计时脚本。未发现不等于平台不存在该功能；尚未获得完整真实浏览器会话和被拒绝的状态响应。
- 可以确认详情按钮依赖服务端状态；不能证明仅靠本地倒计时归零就能购买、一直挂页一定自动变为 BUY NOW、或者必须如何刷新才会变更。
- 开售后仍需正常进入官方购买流程；客户端按钮外观不能替代服务端资格、会话及库存检查。

### 已发现的其他计时器，不能当作开售倒计时

| 计时器 | 公开短代码证据 | 可得结论与局限 |
| --- | --- | --- |
| 问答开始计时（F03） | `timer = quiz.timer`；`setInterval(... timer-- ..., 1e3)` | 初值来自问答响应、页面每秒递减，结束后展示问题；未确认两个活动会进入该分支 |
| 登录 OTP（F03） | `timeLeft = otpInpExp`；`timeLeft > 0 ? timeLeft-- : onFinish()` | 验证码输入/重发相关的本地计时，与售票开放无关 |
| 付款会话（F05） | `paymentCountdown = ...resultReserve.extraPaymentMethods.paymentCountdown`；`leftTime: 60 * paymentCountdown` | 分钟参数来自预订响应并交给前端 countdown 组件；未取得本活动参数，不能填固定时长 |
| 付款计时到期（F05） | `"finished" === l.action` 后显示超时提示并调用 `callExpSession()` | 代码有处理超时的服务调用；没有执行，也没有验证服务端释放时点 |
| 额外登记会话（F05） | `COUNTDOWN[0].valueMessage`；`leftTime: 60 * counting` | 属于额外服务/登记分支，不能推广为本活动付款或选座时长 |

官方正文的 **7-Eleven 现金付款码 30 分钟期限**，仍不能用于推断选中座位即锁票 30 分钟。前端支付组件计时、付款码期限、服务端锁票有效期是需要分别取证的事项。

## 购票流程：静态路径与真实证据分开

| 阶段 | 当前可证实内容 | 尚未真实验证 |
| --- | --- | --- |
| 活动详情 | F01/F02 的公开名称、日期、价格和正文可读；目标 ID 26144，参考 ID 26143 | 最新服务器可售状态、参考活动剩余库存 |
| 点击购票/登录 | F03 的 BUY 点击入口、资格分支、未授权触发登录；`/booking` 有路由守卫 | 正常登录、OTP、验证码、排队及本活动实际分支 |
| 场次和区域 | F03/F05 有场次/区域读取与选择逻辑；F06 提供静态分区图 | 实际座位图、可售场次、区域库存、座号、实时限购判定 |
| 选座 | F05 `selectSeat()` 维护 `selectedSeat`、修改 `available`/`selected` 样式并 `seatsSelected.emit(...)`；父组件 `seatSelectedHandler` 更新座号及金额 | 该 UI 样式不能证明锁定；没有在本活动点击座位 |
| 确认预订 | F05 有独立 `getReserve()` 点击入口与 `callAPIGetReserve()`；成功响应后可能转 `/booking/check-booking`、优惠、附加登记或 `/booking/payment` | 实际预订成功、冲突、排队、服务端占位时点和有效期 |
| 付款 | F05 有付款渠道选择、可选保险、付款提交与超时路径；F01 正文公告支持信用卡、Thai QR、TrueMoney/Alipay/WeChat、柜台付款码等 | 用户账号实际能用哪些方式、手续费计算基数、境外卡/钱包成功、支付确认和订单结果 |
| 取票/入场 | 目标正文的付款证明、姓名匹配证件和代取要求见原研究记录 | 真实订单票据和现场执行 |

座位组件的短证据：

```javascript
t.classList.remove("available"); t.classList.add("selected");
this.selectedSeat.push(n);
this.seatsSelected.emit(this.selectedSeat);
```

上面只有 UI/组件状态变化；随后独立确认流程才出现 `atkService.getReserve(...)`。这支持“选中样式不等于已成功预订”的提示，但仍不足以断言所有布局或服务端都在同一个节点锁票。没有调用任何 booking、登录、reserve 或 payment 接口。

## 目标活动官方区域图与偏好建议

F06 标题明确是 Final EP Fan Moment，地点为影院；图上方标记 **SCREEN**，并列出了粉丝福利。它不是一张包含逐座号、通道标注或实时余票的选座图。

| 票档 | 官方区域 | 图面位置 | 合影福利（按图面文字） |
| --- | --- | --- | --- |
| 2,500 THB | A1、A2 | 靠屏幕的左右两大区域，中间留空 | 随机 100 人为 2:4，其余为 2:8 |
| 2,000 THB | B1、B2、B3 | A 区后方；B2 在中央，呈 U 形 | 随机 40 人为 2:8，其余为 2:10 |
| 1,500 THB | C1、C2 | B1/B3 后方左右两条区域 | 全部为 2:12 |
| 900 THB | D1、D2、D3、D4 | 标记 **2nd FLOOR** 的区域 | 图中无合影福利 |

全票档图示均有 Official Series Postcard 与 HI-BYE。福利人数和合影比例为宣传图文字，不能推导为分区座位数量。

按用户“最高票档优先，无票才逐档降低，靠中或靠过道”的偏好，可在本地辅助界面按 **2,500 → 2,000 → 1,500 → 900** 提示。最高档内部，可先比较 A1/A2 **靠中央空隙一侧**；降档时 B2 位置更居中。用户要求的“靠过道”仍需真实座位图确认：图上空白不能直接认定为可通行过道，不能生成具体排号/座号，也没有证据判断哪一侧是艺人互动路线。

**没有真实热门度证据。** 当前没有各区已售数量、库存、访问量或开售速度。根据位置和福利作出的合理假设是：A 区较可能受到重视近距离/合影的观众偏好，B2 可能受到重视屏幕居中视线的观众偏好；两者均是偏好推测，不是“最热门”“最先售罄”或成功率结论。影院观屏舒适度也不能仅由高票价推断。

## 可直接实现的辅助功能

1. 本地展示官方正文开售时间及 AM/PM 冲突提示；若显示本地倒计时，明确它只按用户设备时间计算，不代表官方开售信号，不触发平台请求、自动点击或刷新。
2. 将目标/参考活动及证据来源放入工作台，显示流程检查项；真实会话的登录、验证码、区域、座位、预订及付款均由用户正常执行并人工标记。
3. 保存最高档逐级备选和靠中/过道偏好；按已证实的区域图提供区域级建议，座号、库存、热门度及锁票状态保持未验证。
4. 本地模拟器可练习“选座 → 确认 → 付款”的交互及冲突/超时，但模拟数据与真实平台证据必须显著区分，不能拿模拟成功率宣称真实抢票成功率。

本次结论仅补充证据；没有为真实平台实现或触发自动选座、占座、订单确认、付款及高频轮询。

## 2026-10-18 云浏览器观察与登录恢复调查

整理时间：01:06（Asia/Shanghai）。证据编号与验收映射见 `CLOUD_ACCEPTANCE.md`。运行未开启截图、录屏、HTML 或快照捕获，不保存账户、Cookie、Token、订单标识或支付信息。

**参考活动 TF-UI-20261018-01：** 用户报告已在 TinyFish 登录并保存 profile；使用相同 Default profile 实际打开 F02 对应活动并点击 BUY NOW。页面显示 Register / Log In，随后弹出包含邮箱/密码、Google 登录和 reCAPTCHA 的登录框。活动日期为 2026-11-22 15:00 GMT+7，地点 Union Hall，价格 5,900 / 4,900 / 3,900 / 2,900 / 1,900 THB。未进入场次、区域、座位或金额核对页面。五档价格和 BUY NOW 可见不等于实时有票；没有选择座位、预订、提交订单或付款。

**目标活动 TF-UI-20261018-02：** 使用独立临时浏览器只读查看 F01 对应公开活动。按钮为 COMING SOON，正文写 2026-10-18 11:00 AM GMT+7，即北京时间 12:00；活动为 2026-10-30 18:30 GMT+7、Siam Pavalai / Paragon Cineplex，票价 2,500 / 2,000 / 1,500 / 900 THB、每张服务费 30 THB。间隔约 6 秒两次查看，未看到数字倒计时；这只说明当时观察范围内不可见，不证明整个网站不存在倒计时，也不能确定开售时是否自动切换或需要刷新。本次没有验证开售时点、购买入口或库存。公开页面未遇 CAPTCHA、排队或拒绝访问；海报 PM 的历史来源差异没有因此被抹除。

**F03 登录机制复核：** 仅在内存读取同一公开 main JS，HTTP 200，1,508,791 bytes，SHA-256 仍为 `f248372753f50a60bf93fb358d9d721212877874b38571dfd3a46d5366f70b6f`。未读取任何真实 profile 内容。以下均为静态路径，不是本次失败根因：

- `callLogin`、社交验证、验证码和 OTP 成功路径均将认证信息写入 localStorage 与 sessionStorage；页头成功回调还向 localStorage 写入用户菜单资料。
- `validateAuthToken`、HTTP 认证拦截器和路由守卫优先使用 localStorage。代码包含有效期及服务端验证，失败分支可能清除登录记录。
- 本版本全文检索未找到 Remember me / stay signed / keep logged 提示；不能据此要求用户勾选一个尚未观察到的开关。
- 直接 Cookie 写入中可见同意设置；这不能排除服务端 HttpOnly Cookie，也不能说明 TinyFish 实际只保存 Cookie。

用户保存后的本次 run 未成功复用登录态，原因仍未知。工具元数据当时为 `signed_in_sites=[]`，运行后 `domain_count=2`；域数量不能证明认证信息保存与恢复。独立浏览器上下文的 storage 恢复、来源域差异、保存时登录尚未完成或令牌验证失败仅为排查方向；普通同源新窗口共享 localStorage，因此“换了窗口”本身不足以解释失败。
