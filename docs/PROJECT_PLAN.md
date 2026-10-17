# 项目计划与里程碑记录

更新日期：2026-10-17（Asia/Shanghai）。当前优先级：**ALL TICKET 第一，TTM 第二**。用户已提供目标活动和参考活动 URL，选择本地运行并要求 GitHub Draft Release。用户澄清此前开售时间只是模糊记忆；原日期推算已撤回。官方正文公告 **2026-10-18 11:00 AM GMT+7（北京时间 12:00）**，但本轮读到的座区海报为 **11:00 PM**，冲突待官方复核。准备时间采用正文的较早时间并明确标注局限。证据见 `ALLTICKET_RESEARCH.md` 和 `ALLTICKET_FLOW_EVIDENCE.md`，执行顺序见 `SALE_DAY_PLAN.md`。

## 当前状态

**最新验收要求：先云端真实验证，再交付可用 Release。** 用户不愿在验收前下载应用到本机测试。当前仍有真实浏览器能力缺口，不能将候选包或 release 分支标为已完成业务验收；逐项状态见 `CLOUD_ACCEPTANCE.md`。

M1、M2 工具实现已完成。新增本地购票辅助：正文日程倒计时、最高票档逐档核对、预算小计、目标座区建议及人工全流程清单。两个 ALL TICKET 活动公开正文、目标座区海报及公开前端代码已分析；正文 AM 与海报 PM 冲突显式保留。实时状态接口返回 403，没有可调用的交互式 Browser/CUA 与用户登录态，真实登录、选座、库存、锁票和付款仍未验证。TTM 尚无真实平台证据。历史测试与本轮结果分别记录，不将本地测试等同于真实购票成功。

| 里程碑 | 状态 | 交付与验收标准 |
| --- | --- | --- |
| M1 基础工程 | 已完成 | FastAPI、React + TypeScript 已通过基础测试、构建和启动验证；依赖清单、锁文件及准备流程已建立 |
| M2 ALL TICKET 优先的浏览器研究 | 工具完成；真实平台待观察 | 独立 ALL TICKET/TTM Adapter；用户输入活动 URL 后能打开浏览器、人工登录、记录加载耗时和脱敏状态；未知结构明确保留未知 |
| M3 本地座位模拟器 | 未开始 | 100～500 座位、区域/票档、库存变化、并发、锁定与释放、延迟和冲突可重复模拟 |
| M4 性能实验 | 未开始 | 多轮人工与辅助策略实验，记录耗时、成功率、冲突率和错误率 |
| M5 ALL TICKET 选座辅助 | 本地准备辅助已实现；真实座位适配待验证 | 最高票档逐档核对、中心/过道策略、官方座区参考与预算；不生成未知可售座号、不自动选座 |
| M6 TTM 深入适配 | 未开始 | 使用独立证据与 Adapter 验证 TTM 辅助能力，不复用未经验证的 ALL TICKET 规则 |
| M7 稳定性验证 | 未开始 | 异常恢复、资源释放、脱敏和完整流程验证 |

## M1 交付记录

- 已完成：FastAPI 后端、React + TypeScript 前端、基础测试框架，以及背景、目标、确定需求、待验证假设、研究模板、测试计划和决策记录。
- 依赖与准备：Python 使用 `pyproject.toml`、`uv.lock`，JavaScript 使用 `package.json`、`package-lock.json`；准备流程已扩展为 `npm ci` 和 `uv sync --locked --all-groups`。声明版本为 Python 3.12.14、uv 0.12.23、Node 24.19.0、npm 11.9.0。
- 测试结果：`pytest tests/unit/test_health.py`：1 项通过；Vitest M1 smoke：1 项通过；`npm run build`：通过。
- 启动验证：`npm run dev` 已启动后端 `127.0.0.1:8000` 与前端 `127.0.0.1:5173`；直接访问后端和经 Vite 代理访问 `/api/health` 均返回 `{"status":"ok","service":"TicketPilot"}`；前端 HTML 返回 HTTP 200。
- 未解决问题：pytest 有 1 条上游 Starlette/httpx 弃用警告；完整准备流程、全部测试和最终依赖一致性检查留待 M2 集成后的统一复验。人工登录未验证。
- 下一步：完成 M2 的浏览器研究路径并进行集成验证。

## M2 交付记录

- 已完成：默认 ALL TICKET、独立 TTM Adapter；输入官方 HTTPS 活动地址后创建临时 Chromium 会话；人工登录指引、页面导航耗时和可见结构观察、未知页面标记、T1/T2/T3 人工时间标记、脱敏日志、SQLite 历史和 JSON 导出。
- 安全与资源行为：不点击、不填写平台表单、不刷新平台；不保存登录态、原始文本/报文、HAR 或截图；限制一个浏览器会话，关闭/失败/重启可清理；关闭尚未完成时阻止新建会话。前端每 2 秒只读取本地 API，WebSocket 延后。
- 完整验证（2026-10-17，Asia/Shanghai）：`npm run setup` 连续 2 次通过，`package-lock.json` 和 `uv.lock` 哈希不变；`npm run check` 通过；`npm test` 后端 30 项、前端 22 项通过；`npm run test:browser` 本地 Chromium 2 项通过；`npm run test:e2e` 3 项通过；合计 **57 项测试通过**；`npm run build` 和 `git diff --check` 通过。
- 浏览器验证：本地测试页确认未触发订单/表单动作、记录不含测试敏感值；实际 React 工作台验证启动、观察、时间标记、导出、关闭；1440px 桌面与 390px 手机布局已检查。所有这些均为本地 fixture 或模拟 API，没有真实平台请求。
- 研究范围限制：当前只观察主文档通用可见结构；iframe 内容、Canvas 座位图、真实座位库存和锁票机制仍未识别。原始 URL 仅用于内存中的导航，存储/导出仅保留平台来源和脱敏路径。
- 未解决问题：真实页面结构、官方开售时间、参考活动是否在售及用户人工登录仍未验证；云端 HEAD 在代理 CONNECT 阶段被 403 拒绝。1 条上游 Starlette/httpx 弃用警告不影响测试。
- 下一步：当前实例加载用户保存的网络配置后进行保守公开页面观察；先核实官方线上开售时间及规则，再落实用户本地执行计划。记录正常登录及流程证据后再开展 M3 模拟器和 ALL TICKET 选座辅助。

## GitHub Draft Release 交付

- 专用分支：`release/v0.1.0-m2-preview`，没有改写 main。
- 已创建 [TicketPilot v0.1.0-m2-preview 草稿](https://github.com/Romofish/TicketPilot/releases)，Release ID `415622865`；API 已确认 `draft=true`、`prerelease=true`。草稿仅向有仓库相应权限的用户显示，不公开发布。
- CLI 经原代理已确认 Romofish 和仓库 push/admin 权限；直接 `gh release upload` 在 `uploads.github.com` 返回 **401 Bad credentials**。这与先前网络 CONNECT 403 不同：API 认证及草稿创建成功，上传通道认证仍有问题，不能将 HEAD 可达或草稿创建等同于资产上传成功。
- 资产交付改用 `.github/workflows/draft-release.yml`：仅手动触发，使用 GitHub Actions 标准 `GITHUB_TOKEN`，只允许更新现有草稿；校验指定提交与草稿 target 一致，重复打包、上传 ZIP/SHA256SUMS、回下载并逐字节比对。工作流不发布 Release，不访问票务平台，也不需要新增用户密钥。
- 首次 [Actions 执行 39009442651](https://github.com/Romofish/TicketPilot/actions/runs/39009442651) 已成功：两个资产均为 uploaded，重复打包和上传后回下载逐字节比对通过，草稿仍为 draft/prerelease。该次打包来源为 3e5a608；本段状态文档提交后，以相同流程刷新最终提交的资产并再次验证，最终来源以 Release targetCommitish 和 Actions 为准。
- 本地源码 ZIP 已重复打包字节一致；发行包排除真实 .env、数据库、缓存、依赖和浏览器登录状态。历史版本已在全新解压目录通过 setup/build，本次文档更新后的包已在全新临时目录通过 `npm run setup` 和 `npm run build`，未复用项目依赖、虚拟环境或缓存。

## 本次恢复验证（2026-10-17，Asia/Shanghai）

- 已读取 AGENTS、PROJECT_PLAN、REQUIREMENTS、ASSUMPTIONS；核对 Node 24.19.0、npm 11.9.0、Python 3.12.14、uv 0.12.23，均匹配。
- `npm run setup`、`npm run check`、`npm test`（后端 30、前端 22）、`npm run test:browser`（2）、`npm run test:e2e`（3）、`npm run build` 和 `git diff --check` 均通过，共 **57 项测试**。浏览器测试只使用本地 fixture/模拟 API；上游 Starlette/httpx 弃用警告 1 条。
- 未修改应用代码、依赖、锁文件、运行时声明或真实 .env；新增手动草稿资产工作流。两份锁文件与恢复分支完全一致。
- 新实例域名名单包含 ALL TICKET 和 GitHub API/上传域名。状态工具 policy.state=unknown，实际命令在 network 权限下成功访问 API 和官网公开文字；部分 CDN/验证资源仍被策略拒绝。详细范围见 `CLOUD_NETWORK.md`。
- 官方证据：目标 **2026-10-18 11:00 GMT+7 / 北京时间 12:00** 开售，网上及柜台同时开放，每单最多 4 张且不得重复购买；价格、费用、付款和取票退改要求已写入 `ALLTICKET_RESEARCH.md` 与 `SALE_DAY_PLAN.md`。现金付款码 30 分钟不等于锁票时长。
- 参考活动地址已确认，存在 BUY NOW 按钮；其身份证专场和付款后 1 小时实名规则独立记录，不用于目标活动。未验证实时库存。
- 下一步：用户本地正常打开官网、复核完整规则并人工登录；M3 模拟器和后续选座辅助仍未开始。本次未新增倒计时、提醒、定时刷新或真实平台自动操作。

## 使用前需要区分的两类验证

1. **工具验证**：准备脚本、API、前端、数据库、浏览器固定页面及脱敏行为，由自动测试和启动检查证明。
2. **平台观察**：具体活动中的页面状态和人工流程，只能由该活动的正常浏览会话提供证据，分别写入平台研究记录。

用户已选择在自己电脑启动后端和前端。浏览器运行在后端机器；仅访问云端前端页面不会把 Playwright 浏览器转移到用户电脑。如以后改为云端人工登录，需要可访问桌面，涉及基础配置时须告知用户。

## 本轮购票辅助交付与验证（2026-10-17，Asia/Shanghai）

- 从本地 `origin/release/v0.1.0-m2-preview` 恢复至独立分支 `work/allticket-flow-assistance`，初始工作区没有用户修改。运行时版本全部匹配；`npm run setup` 成功，基线后端 30、前端 22 项通过。
- 已实现：按正文时间计算的本地倒计时、AM/PM 来源冲突说明、用户确认的最高档逐级策略、靠中/过道与连座偏好、票数 1–4 校验、已知票面和服务费小计、人工票档状态、官方目标座区参考、目标/参考隔离的七步核对清单。未知状态阻止跳档，修改票数/位置/连座要求清空旧状态，预算跟随下一待核对档。
- 官方研究：两个活动公开 JSON、公开 main/booking 脚本、目标海报均已读取；售票状态接口各一次返回 403，未重试。没有足够诊断证据确定 403 层级。没有可用交互式 Browser/CUA 和用户登录态，未进行真实点击购票、选座、预订或支付。
- 倒计时结论：公开按钮逻辑受服务端活动状态控制，普通购票点击后还需场次校验；未定位本目标活动开售倒计时实现，不能保证归零自动出现 BUY NOW。支付会话计时与现金码 30 分钟不能等同座位锁定时间。详见 `ALLTICKET_FLOW_EVIDENCE.md`。
- 最终验证：`npm run check`、`npm test`（后端 30、前端 70）、`npm run test:browser`（2）、`npm run test:e2e`（6）、`npm run build` 均通过，共 **108 项测试**。浏览器测试均使用本地 fixture/模拟 API；E2E 覆盖到点不请求官网、未知票档不跳档、人工降档、改变数量清空状态、清单切换隔离、原研究全流程与 390px 无横向溢出。
- 已查看桌面辅助面板和手机完整工作台截图；均为本地测试页面，不是官方购票截图。保留 1 条上游 Starlette/httpx 弃用警告，未为此升级依赖。
- 无新增依赖或配置；两份锁文件和运行时声明未改变。独立代码审查未发现剩余阻塞问题。最终 `git diff --check` 与源码包完整性另在交付时核验。
- 本轮修改仅在工作区和本地源码包，未提交、推送或更新既有 GitHub Draft Release；历史草稿不能当作包含本轮修改。
- 未完成项：用户要求的真实全流程仍受交互浏览器能力及当前状态读取失败限制；需在用户可操作且正常登录的官网浏览器中继续取证，保留真实付款前的订单信息核对。张数、预算及连座是否必须仍由用户决定。M3 并发模拟器和自动真实选座没有实现。

## Release 交付核查与云端验收要求更新（2026-10-17）

- 用户明确要求先在云端完成真实验证，不下载未验收应用到本机测试；已同步 `REQUIREMENTS.md`、README 和 `CLOUD_ACCEPTANCE.md`。
- GitHub API 实测：Release `415622865` 确实存在，`tag_name=v0.1.0-m2-preview`、`draft=true`、`prerelease=true`、`published_at=null`，含源码 ZIP 和 SHA256SUMS 两个 uploaded 附件。旧包来源提交为 `5744379bcc75934f090835cd43e1dae54c5861a4`，对应成功 Actions `39009479531`。已实际回下载旧包；因此“只有 release 分支”不是完整事实，但当前新增功能尚需候选上传，且草稿未公开发布这一点此前交付说明不充分。
- 本轮重新执行 `npm run setup`、`npm test`（30 后端 + 70 前端）、`npm run test:browser`（2）、`npm run test:e2e`（6）、`npm run build`，共 108 项通过；setup 包含类型/lint。测试依然只验证本地 fixture 与模拟 API，不代表登录、选座或支付成功。
- 候选交付流程：提交当前功能与证据、推送独立工作分支、更新既有 Draft 目标和说明、触发既有 Actions，再从 Release 回下载并与同提交本地产物逐字节及 SHA-256 核对。最终结果与链接以 Release 说明和交付消息中的核验结果为准，不公开发布正式版，不改变默认分支。
- 云端当前有 Chromium/Xorg/桌面程序，但没有运行的可接管图形显示、Browser/CUA 或受保护桌面入口；Secrets 不能替代该入口。已发现并建议 TinyFish 云浏览器插件，尚未安装或连接，不保证 ALL TICKET 兼容性。第三方浏览器平台取证还需与 TicketPilot 同版本的云端集成测试区分。
- 真实验收未完成，详见 `CLOUD_ACCEPTANCE.md`。用户确认按泰国 11:00 AM 准备，正文同样支持 AM；目标真正的开售切换仍需到点观察。候选源码不是桌面安装包，当前不要求用户下载到本机验证。

## 每个里程碑结束时更新

- 最终交付与相对验收标准的差异。
- 实际执行的命令、结果、测试范围和未执行项及原因。
- 新增依赖、锁文件、准备脚本、环境变量示例和 `AGENTS.md` 是否同步。
- 已知问题、真实平台证据的适用范围以及下一步最小行动。
