# TicketPilot

ALL TICKET 优先、TTM 第二的本地购票准备与浏览器研究工具。提供官方开售时间倒计时、票档降级建议、费用与预算核对、人工流程清单，以及正常浏览器中的脱敏观察记录。座位选择、订单和付款仍由用户在官网完成；真实平台完整购票流程尚未验证。

当前为 **Draft 候选版，尚未完成云端真实购票验收**。用户已要求先在云端验收，下面的本机运行说明供未来使用，并不要求用户现在下载安装测试。验收范围、云浏览器接入缺口和逐项状态见 [云端验收记录](docs/CLOUD_ACCEPTANCE.md)。

## 本机运行

需要 Node.js **24.19.0**、npm **11.9.0**、Python **3.12.14**、uv **0.12.23**，以及能显示 Chromium 的桌面环境。版本记录在 `.nvmrc`、`.python-version` 和依赖清单。有 nvm 时可运行 `nvm install && nvm use`。准备脚本不安装系统运行时。

```sh
cd TicketPilot
npm run setup
npm run setup:browser
npm run dev
```

打开 <http://127.0.0.1:5173>，后端位于 <http://127.0.0.1:8000>，接口文档为 `/docs`。`Ctrl+C` 停止前后端。当前云端项目目录为 `/workspace/TicketPilot`，下载后使用自己的目录。

准备脚本执行 `npm ci`、`uv sync --locked --all-groups` 和代码检查，仅在不存在时创建 `.env`。重复运行保留现有 `.env`。`setup:browser` 安装 Playwright Chromium，不隐式安装系统库。

浏览器打开在**后端所在电脑**上。当前云端没有已连接的可接管桌面或 Browser/CUA 通道，云端无头测试不能用于人工登录；云端真实验收需先建立受控浏览器会话。用户名密码或域名允许名单本身不能建立这个交互入口。

## 研究流程

1. 选择 ALL TICKET（默认）或 TTM，输入官方 HTTPS 活动 URL 和可选名称。目标活动与参考活动可一键填入。
2. 开启会话，在弹出的 Chromium 中自行登录、处理验证码或排队。
3. 查看加载记录；点击观察按钮记录当前页面的可见结构和通用状态候选。未知页面明确标为未识别，座位状态为未验证。
4. 按实际观察标记 T1（进入选座）、T2（人工选择后）、T3（人工确认后）。标记只记录时间，不执行平台操作，也不判定锁票成功。
5. 导出脱敏 JSON；结束会话关闭浏览器并丢弃临时登录态。本地 SQLite 保留脱敏历史。

目标：[PlsLoveFanScreeningFinalEP](https://www.allticket.com/event/PlsLoveFanScreeningFinalEP)。参考：[LENAMIUGirlsNightOutBDParty](https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty)。目标官方正文公告 **2026-10-18 北京时间 12:00 / 泰国时间 11:00 AM** 开售，公开文字于 2026-10-17 核实；但同页座区海报印有 **11:00 PM**，存在 12 小时冲突。程序按正文较早时间做准备并提示冲突，最终须复核官网更新。证据见 [ALL TICKET 研究](docs/ALLTICKET_RESEARCH.md)，准备顺序见 [活动执行计划](docs/SALE_DAY_PLAN.md)，倒计时与购票代码分析见 [流程证据](docs/ALLTICKET_FLOW_EVIDENCE.md)。

## 购票辅助

- 用户已确认的策略：最高票档优先，官网明确无票再降到下一档；座位靠中或靠过道。目标票档顺序为 2,500 → 2,000 → 1,500 → 900 THB。尚未确认张数，界面初值可修改。
- 本地倒计时使用本机时钟；到点只提示计划时间已到，不能证明官网已经开放或仍有库存，也不自动刷新、跳转或下单。
- 按实际张数计算已知票面与服务费小计；支付手续费基数尚未核实，不伪造最终应付金额。确认订单前以官网总额为准。
- 票档状态和流程核对由用户人工填写；“未知”不会被当作售罄而自动降档。切换活动清空本地核对，参考活动的规则与目标分开。
- 座位建议是观演偏好分析。没有实时销量或库存变化证据，不提供虚构热门榜、具体可售座号或锁票保证。辅助面板不保存个人、证件或支付资料。

## 配置和隐私

`.env.example` 提供安全默认值。当前无需 API 密钥；平台凭据只在官方页面输入。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `TICKETPILOT_HEADLESS` | `false` | 人工登录保留 false；true 仅供无需人工交互的测试 |
| `TICKETPILOT_BROWSER_EXECUTABLE_PATH` | 空 | Playwright Chromium 或已有浏览器的完整路径 |
| `TICKETPILOT_DATA_DIR` | `data` | 本地 SQLite 目录 |
| `TICKETPILOT_NAVIGATION_TIMEOUT_MS` | `45000` | 初始页面导航超时，不触发自动重试 |
| `TICKETPILOT_CAPTURE_COOLDOWN_SECONDS` | `3` | 人工记录按钮的最短间隔 |

不记录 Cookie、Token、原始正文、表单值、网络报文、HAR、trace 或真实页面截图。URL 路径、查询和片段脱敏后保存；活动名称供人工关联。浏览器登录态只存在于临时会话。

## 验证与依赖维护

```sh
npm run check
npm test
npm run test:browser
npm run build
npm run test:e2e       # 自动启动独立测试前端，测试完成后停止
```

前两项覆盖类型、lint、单元/API 和 React 测试；浏览器测试使用本地页面，前端 E2E 使用模拟 API，不请求真实库存。云端可设置 `TICKETPILOT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium` 使用已有 Chromium。

新增依赖须同步维护清单、锁文件、准备步骤和环境变量示例，详见 [AGENTS.md](AGENTS.md)。准备流程不依赖容器上一次安装状态。

## 项目上下文

- [背景](docs/BACKGROUND.md)、[目标](docs/GOALS.md)、[确定需求](docs/REQUIREMENTS.md)、[待验证假设](docs/ASSUMPTIONS.md)
- [里程碑与测试结果](docs/PROJECT_PLAN.md)、[测试计划](docs/TEST_PLAN.md)、[技术决策](docs/DECISIONS.md)
- [ALL TICKET 研究](docs/ALLTICKET_RESEARCH.md)、[TTM 研究](docs/TTM_RESEARCH.md)

`backend/` 包含 API、独立 Adapter、研究服务、模型和存储；`frontend/` 为 React 工作台及本地购票辅助。`tests/unit/`、`tests/browser/`、`tests/e2e/` 分别验证后端规则、页面观察、界面流程。真实座位解析与自动选座尚未交付。

## 发行包

`npm run release:package` 在 `dist/` 生成可复现源码 ZIP 和 SHA256SUMS，详见 [发布说明](docs/RELEASE_NOTES.md)。GitHub Release 的发布状态、来源提交与附件必须单独验证；`release/…` 分支不是 Release，源码 ZIP 也不是已验证的桌面安装包。Draft 仅向有仓库相应权限的登录用户显示。云网络情况见 [网络记录](docs/CLOUD_NETWORK.md)。
