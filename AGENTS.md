# TicketPilot 开发约定

## 每次任务开始

1. 阅读本文件、`docs/PROJECT_PLAN.md`、`docs/REQUIREMENTS.md`、`docs/ASSUMPTIONS.md`。**ALL TICKET 是首要平台，TTM 是第二平台。** 研究问题不等于已验证的平台机制。
2. 检查 `git status --short`，保留已有修改。核对 Node.js 24.19.0、npm 11.9.0、Python 3.12.14、uv 0.12.23；版本以 `.nvmrc`、`.python-version`、`package.json`、`pyproject.toml` 为准。
3. 执行 `npm run setup`，从两份锁文件恢复依赖，仅在 `.env` 不存在时复制示例，并执行代码检查。禁止隐式升级工具或修改系统软件。
4. 执行 `npm test` 获取前后端基线。浏览器服务、Adapter 或页面观察改动还需 `npm run test:browser`。UI 改动运行实际浏览器交互和移动视口检查。

## 产品与研究边界

- 平台逻辑分别位于 `backend/adapters/allticket.py` 和 `ttm.py`；不得编造平台 API、Selector、库存或锁票规则。未知结构返回 unknown，座位状态为 unverified。
- M2 只打开用户指定的官方活动地址，登录、验证码、排队与购票由用户在浏览器中完成。代码不得自动选座、占座、确认订单、支付或绕过平台控制。
- 不定时刷新平台或批量请求库存。前端轮询本地记录不能触发平台请求。T1/T2/T3 是人工时间标记，不代表系统判定预订成功。
- 本地购票辅助使用已记录的官方日程与费用；倒计时归零不能宣称官网开售成功。用户确认最高档优先、明确无票才降档、靠中或靠过道；未知库存保持未知，偏好变化清空依赖该偏好的人工库存记录。图片与正文冲突必须显式展示，不以推测修正文案。
- 真实平台观察记录日期、活动、适用范围和脱敏证据；本地模拟结果不得作为真实平台事实。并发与锁票策略实验只能在本地模拟环境进行。
- 默认在用户自己的电脑运行有界面浏览器。浏览器窗口出现在后端机器上；无头测试不代表已完成人工登录。
- 不保存账号密码、Cookie、Token、支付信息、持久化浏览器 profile、原始请求/响应体、HAR、trace 或真实平台截图。异常与验证响应不能泄露原始敏感输入。

## 依赖和配置维护

- JS 清单/锁文件为 `package.json` + `package-lock.json`；Python 为 `pyproject.toml` + `uv.lock`，不能依赖全局库或旧容器状态。
- JS 新增/升级使用 `npm install --save-exact <包>@<版本>`，开发依赖加 `--save-dev`。Python 使用 `uv --cache-dir .cache/uv add --bounds exact <包>`，开发依赖加 `--dev`。删除依赖也通过包管理器，禁止手改锁文件。
- 每次依赖变化同步检查并维护准备脚本、`.env.example`、README、此文件与运行时声明；运行 `npm run setup`、`npm test` 及相关浏览器测试。无相关变化无需制造无意义修改。
- 日常恢复使用 `npm ci`、`uv sync --locked --all-groups`。缓存位于 `.cache/`，虚拟环境位于 `.venv/`，均被 Git 忽略。
- `npm run setup:browser` 安装 Chromium，不自动安装系统库。可通过 `TICKETPILOT_BROWSER_EXECUTABLE_PATH` 使用现有浏览器。需要系统库、图形桌面、网络域名或密钥时，明确告知用户所需云环境调整。
- `.env.example` 只含变量用途和安全默认值；不得提交或打印真实 `.env` 和凭据。新配置补充示例。准备脚本须可重复执行、遇错退出并保留已有 `.env`。

## 完成前验证

执行 `npm run check`、`npm test`、`npm run build`；浏览器改动运行 `npm run test:browser`；UI 改动运行 `npm run test:e2e`（自动启动独立测试前端）。自动化浏览器测试仅使用本地 fixture 或模拟 API。

检查 `git diff --check` 和 `git status --short`。每完成里程碑更新 `docs/PROJECT_PLAN.md`，记录交付、实际测试结果、未解决问题和下一步。研究证据分别记录在两个平台研究文档。

Codex 受限沙箱的依赖下载、本地监听、TestClient 和浏览器命令可能需要该命令的 network 权限；这不等于更改云端域名白名单。保留现有代理和 CA，不关闭 TLS 校验或绕过网络策略。
