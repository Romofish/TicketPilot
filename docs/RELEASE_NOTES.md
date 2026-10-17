# TicketPilot v0.1.0-m2-preview

## 当前候选状态（2026-10-18，Asia/Shanghai）

本轮源码增加开售准备与人工购票核对：本机倒计时、最高票档优先/明确无票再降档、中心/过道偏好、票面与服务费预算、官方目标座区参考、活动隔离的七步核对清单。到点不自动请求官网；人工标记不等于实时库存或支付成功。更改购票偏好会清空依赖旧偏好的票档状态。

已读取官方目标座区海报和公开购票代码，证据见 `docs/ALLTICKET_FLOW_EVIDENCE.md`。用户确认按正文的 11:00 AM GMT+7 准备，海报 PM 写法保留为来源差异。2026-10-18 的独立云浏览器已看到目标 COMING SOON 与正文 AM；间隔约 6 秒两次观察未看到数字倒计时，不能断言不存在，实际到点切换仍待观察。参考活动真实点击 BUY NOW 后弹出登录框，尚无座位、库存或支付实测证据，也没有实际销售热度排行。

用户已授权推送当前源码；阶段性 e6f42fe 的两个 Draft 附件已上传并回下载核验，详见下方交付记录。本文记录打包前的证据；当前候选最终提交与附件核验以 GitHub Release 说明和 Actions 为准。现有软件验证记录为 108 项通过，本次文档修订未重跑全套测试。真实云端流程验收状态见 `docs/CLOUD_ACCEPTANCE.md`，不得将候选上传解释为正式发布或实购验证成功。后面的旧版记录属于历史交付。

这是源码草稿候选，ALL TICKET 优先、TTM 第二，不是桌面安装包。用户要求先完成云端真实验收，验收前不要求下载或运行本机应用。用户已报告在 TinyFish 登录并保存 profile，但同 profile 的参考活动购买入口仍要求登录，原因未知；C02 阻塞、C03 已观察、C04–C07 未执行。TicketPilot 同版本云端浏览器集成未验证，不能将插件平台观察等同于应用完整流程通过。

## 本次范围

- Python FastAPI 后端、React + TypeScript 前端、SQLite 本地研究记录，以及前后端和本地浏览器测试框架。
- 独立 ALL TICKET/TTM Adapter；输入活动 URL 后创建浏览器会话，记录加载时间、通用可见状态候选、异常和脱敏事件。
- 人工标记 T1/T2/T3、手动请求观察、查看历史、导出脱敏 JSON、结束会话。
- 本地 API 以 2 秒间隔轮询更新工作台记录；此轮询不刷新或重新访问平台页面。WebSocket 留作后续传输选项。
- 目标与参考活动快捷入口；用户提供的开售信息与官方证据分别记录在 `docs/ALLTICKET_RESEARCH.md`。

本版不自动选择或占用座位、不确认预订、不提交订单或支付，不绕过验证码、队列和平台限制。页面结构未知时保留未知，座位状态为未验证。M3 模拟器、M4 性能实验尚未交付；M5 已有本地偏好准备辅助，真实座位适配仍待验证。

## 后续本机运行参考

以下保留源码运行方法，供完成云端验收后使用，不作为本轮要求用户执行的验证步骤。

需要 Node.js **24.19.0**、npm **11.9.0**、Python **3.12.14**、uv **0.12.23**，以及能显示 Chromium 的桌面环境。准备脚本恢复锁定依赖，不自动安装运行时或操作系统库。

解压源码包，进入解压后的 `TicketPilot-v0.1.0-m2-preview` 目录：

```sh
npm run setup
npm run setup:browser
npm run dev
```

浏览器打开 <http://127.0.0.1:5173>。后端监听 <http://127.0.0.1:8000>。在研究工具里创建会话后，另一个 Chromium 窗口会出现在运行后端的电脑上；用户在该窗口自行登录、处理验证码或排队。完成后结束会话，终端按 `Ctrl+C` 停止服务。

`setup` 使用 `npm ci` 与 `uv sync --locked --all-groups`，仅在 `.env` 不存在时从 `.env.example` 创建，并保留已有配置。`setup:browser` 下载 Playwright Chromium；若操作系统缺少图形库，需要先按该系统要求安装。当前应用无需新增 API 密钥。

## 源码包及校验

交付文件为 `TicketPilot-v0.1.0-m2-preview-source.zip` 和 `SHA256SUMS`。源码包不包含预编译二进制、浏览器、依赖目录、数据库、登录状态或真实 `.env`；首次准备仍需要下载锁定依赖。

在同一目录保存 ZIP 与校验文件后，可用系统工具验证：

```sh
# Linux
sha256sum -c SHA256SUMS
# macOS
shasum -a 256 -c SHA256SUMS
```

Windows PowerShell 可执行 `Get-FileHash .\TicketPilot-v0.1.0-m2-preview-source.zip -Algorithm SHA256`，将结果与 `SHA256SUMS` 中的值比较。

维护者可运行 `python scripts/package_release.py` 重建 `dist/` 中的产物。脚本只纳入显式源码目录与根配置白名单，按路径排序，统一文件权限，拒绝被选中的符号链接和二进制内容，并排除运行数据、依赖、缓存和敏感命名文件。脚本也检测常见凭据格式；这不能替代源码审查。

默认使用固定 ZIP 时间戳 1980-01-01 UTC，或使用 `SOURCE_DATE_EPOCH`（UTC，ZIP 支持 1980～2107 年，秒数按 ZIP 精度取偶数）。同一源码内容、相同时间戳设置产生相同 ZIP 字节与 SHA-256；打包不包含文件原始时间和本机绝对路径。

## 验证记录

当前功能沿用 2026-10-17 已完成的软件验证：后端单元/API 30 项、前端 70 项、本地 Chromium 2 项、工作台 E2E 6 项，合计 **108 项通过**；类型/lint 与生产构建通过。浏览器测试均使用本地 fixture 或模拟 API，本次文档修订未重跑这些检查，实际平台登录与购票流程仍未验收。详细命令与范围见 `docs/PROJECT_PLAN.md`。

旧版 M1/M2 历史记录为 57 项通过（后端 30、前端 22、浏览器 2、E2E 3），不作为当前功能或真实业务流程的新验收结果。

## 官方活动信息与已知限制

- [目标官方活动页](https://www.allticket.com/event/PlsLoveFanScreeningFinalEP)公开文字已于 2026-10-17 核实：**2026-10-18 11:00 Asia/Bangkok（GMT+7），即北京时间 12:00** 开售，网上和 7-Eleven 柜台同时开放。每单最多 4 张，禁止重复购买。
- 票价 2,500 / 2,000 / 1,500 / 900 THB，每张另收 30 THB 服务费及适用付款渠道费。7-Eleven 现金付款码须在 30 分钟内付款；此期限不能视作锁票时长。取票与退改等规则见 `docs/SALE_DAY_PLAN.md` 和 `docs/ALLTICKET_RESEARCH.md`。
- 参考活动官方地址已确认；其身份证专场和付款后 1 小时观众登记属于参考活动，不能套用到目标活动。
- 公开正文、目标座区海报和前端代码已查，但正常登录、具体座号、库存、排队、锁票及付款仍未验证。旧版云环境的图片限制和 Chromium CA 问题见历史研究记录；TinyFish 工具可调用本身不能证明这些业务节点已通过。
- 当前要求先完成云端真实验收；TicketPilot 尚未接入 TinyFish 会话。新增的本地倒计时不代表官网可售，不自动刷新或执行购票动作。

## Draft Release 交付

当前候选来源为独立工作分支 `work/allticket-flow-assistance`，不改变默认分支。用户已授权推送；[仓库 Release 列表](https://github.com/Romofish/TicketPilot/releases) 中的现有草稿保持 **draft=true、prerelease=true**，不公开发布正式版。阶段性提交 `e6f42fe0e21e243bb1bb854538000c2b2937d7c1` 已推送，[Actions 39051746569](https://github.com/Romofish/TicketPilot/actions/runs/39051746569) 成功；源码 ZIP 与 SHA256SUMS 两个附件已回下载，与本地产物及该提交的 69 个 Git 文件逐一匹配。ZIP 为 424168 字节，SHA-256 为 `3b4120f460c7f345637fa62ac596d93532ec526cb100e64b206b5f14c5070098`。

上述校验值只适用于 e6f42fe 阶段资产。本文记录新增真实云端证据打包前的状态；当前候选最终提交与附件核验以 GitHub Release 说明和 Actions 为准，不能沿用阶段性校验值。

旧版历史来源为 `release/v0.1.0-m2-preview`；其草稿、源码包及校验文件此前已核实存在，旧工作流曾完成上传与回下载校验。旧版结果不能代替更新后资产的核验。草稿仅向有仓库相应权限的用户显示，最终目标提交、资产与执行记录以 GitHub 元数据及 `docs/PROJECT_PLAN.md` 的核验结果为准。
