# 项目计划与里程碑记录

更新日期：2026-10-17（Asia/Shanghai）。当前优先级：**ALL TICKET 第一，TTM 第二**。用户已提供目标活动和参考活动 URL，选择本地运行并要求 GitHub Draft Release。用户澄清此前开售时间只是模糊记忆；原日期推算已撤回，现已核实目标活动于 **2026-10-18 11:00 GMT+7（北京时间 12:00）** 开售，官方活动页的时间和规则是规划依据。证据见 `ALLTICKET_RESEARCH.md`，待核实规则与执行顺序见 `SALE_DAY_PLAN.md`。

## 当前状态

M1、M2 工具实现已完成，并通过本地自动化测试及浏览器集成验证。本次已读取两个 ALL TICKET 官方活动的公开文字，开售和文字购票规则已核实；图片及部分验证资源受阻，登录、座位图、库存和锁票节点仍未确认。TTM 尚无真实平台证据。完整准备流程连续运行两次成功，两份锁文件 SHA-256 未变。

| 里程碑 | 状态 | 交付与验收标准 |
| --- | --- | --- |
| M1 基础工程 | 已完成 | FastAPI、React + TypeScript 已通过基础测试、构建和启动验证；依赖清单、锁文件及准备流程已建立 |
| M2 ALL TICKET 优先的浏览器研究 | 工具完成；真实平台待观察 | 独立 ALL TICKET/TTM Adapter；用户输入活动 URL 后能打开浏览器、人工登录、记录加载耗时和脱敏状态；未知结构明确保留未知 |
| M3 本地座位模拟器 | 未开始 | 100～500 座位、区域/票档、库存变化、并发、锁定与释放、延迟和冲突可重复模拟 |
| M4 性能实验 | 未开始 | 多轮人工与辅助策略实验，记录耗时、成功率、冲突率和错误率 |
| M5 ALL TICKET 选座辅助 | 未开始 | 基于已验证证据识别用户偏好，遵循官方规则及用户确认 |
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
- 已创建 [TicketPilot v0.1.0-m2-preview 草稿](https://github.com/Romofish/TicketPilot/releases/tag/untagged-1ccc95584cc5fb88385b)，Release ID `415622865`；API 已确认 `draft=true`、`prerelease=true`。草稿仅向有仓库相应权限的用户显示，不公开发布。
- CLI 经原代理已确认 Romofish 和仓库 push/admin 权限；直接 `gh release upload` 在 `uploads.github.com` 返回 **401 Bad credentials**。这与先前网络 CONNECT 403 不同：API 认证及草稿创建成功，上传通道认证仍有问题，不能将 HEAD 可达或草稿创建等同于资产上传成功。
- 资产交付改用 `.github/workflows/draft-release.yml`：仅手动触发，使用 GitHub Actions 标准 `GITHUB_TOKEN`，只允许更新现有草稿；校验指定提交与草稿 target 一致，重复打包、上传 ZIP/SHA256SUMS、回下载并逐字节比对。工作流不发布 Release，不访问票务平台，也不需要新增用户密钥。
- 工作流实际执行结果须在 [Actions](https://github.com/Romofish/TicketPilot/actions/workflows/draft-release.yml) 和 Release 资产列表确认；直接 CLI 上传失败不作为上传完成的证据。最终交付状态另由本次执行结果报告。
- 本地源码 ZIP 已重复打包字节一致；发行包排除真实 .env、数据库、缓存、依赖和浏览器登录状态。历史版本已在全新解压目录通过 setup/build，本次文档更新后的包另行复验。

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

## 每个里程碑结束时更新

- 最终交付与相对验收标准的差异。
- 实际执行的命令、结果、测试范围和未执行项及原因。
- 新增依赖、锁文件、准备脚本、环境变量示例和 `AGENTS.md` 是否同步。
- 已知问题、真实平台证据的适用范围以及下一步最小行动。
