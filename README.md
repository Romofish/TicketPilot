# TicketPilot

ALL TICKET 优先、TTM 第二的本地浏览器研究工具。通过正常浏览器记录加载时间、可见结构和人工观察时间点，为后续选座辅助积累证据。当前范围为 **M1 基础工程 + M2 Browser Research**；不自动选座、占座、提交订单或支付，真实平台机制尚未验证。

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

浏览器打开在**后端所在电脑**上。用户已选择本机运行；云环境没有图形桌面，云端无头测试不能用于人工登录。若以后需要云端人工操作，需配置受控桌面及官方域名网络访问。

## 研究流程

1. 选择 ALL TICKET（默认）或 TTM，输入官方 HTTPS 活动 URL 和可选名称。目标活动与在售参考活动可一键填入。
2. 开启会话，在弹出的 Chromium 中自行登录、处理验证码或排队。
3. 查看加载记录；点击观察按钮记录当前页面的可见结构和通用状态候选。未知页面明确标为未识别，座位状态为未验证。
4. 按实际观察标记 T1（进入选座）、T2（人工选择后）、T3（人工确认后）。标记只记录时间，不执行平台操作，也不判定锁票成功。
5. 导出脱敏 JSON；结束会话关闭浏览器并丢弃临时登录态。本地 SQLite 保留脱敏历史。

目标：[PlsLoveFanScreeningFinalEP](https://www.allticket.com/event/PlsLoveFanScreeningFinalEP)。参考：[LENAMIUGirlsNightOutBDParty](https://www.allticket.com/event/LENAMIUGirlsNightOutBDParty)。参考地址去掉了用户链接末尾的分号，规范 URL 尚待实地验证。用户提供开售时间为“明天泰国 11:00 / 北京 12:00”，以平台最终显示为准，见研究文档。

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

`backend/` 包含 API、独立 Adapter、研究服务、模型和存储；`frontend/` 为 React 工作台。`tests/unit/`、`tests/browser/`、`tests/e2e/` 分别验证后端规则、页面观察、界面流程。模拟器与选座辅助属于后续 M3–M5，尚未交付。
