# TicketPilot v0.1.0-m2-preview

M1/M2 源码预览版，ALL TICKET 优先、TTM 第二。用户在自己的电脑打开研究工具，由 Playwright 启动浏览器后人工登录和操作。本次交付用于记录正常页面加载和观察结果，不承诺购票成功。

## 本次范围

- Python FastAPI 后端、React + TypeScript 前端、SQLite 本地研究记录，以及前后端和本地浏览器测试框架。
- 独立 ALL TICKET/TTM Adapter；输入活动 URL 后创建浏览器会话，记录加载时间、通用可见状态候选、异常和脱敏事件。
- 人工标记 T1/T2/T3、手动请求观察、查看历史、导出脱敏 JSON、结束会话。
- 本地 API 以 2 秒间隔轮询更新工作台记录；此轮询不刷新或重新访问平台页面。WebSocket 留作后续传输选项。
- 目标与参考活动快捷入口；用户提供的开售信息与官方证据分别记录在 `docs/ALLTICKET_RESEARCH.md`。

本版不自动选择或占用座位、不确认预订、不提交订单或支付，不绕过验证码、队列和平台限制。页面结构未知时保留未知，座位状态为未验证。M3 模拟器、M4 性能实验及 M5 选座辅助尚未交付。

## 在本机运行

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

2026-10-17 集成验证：后端单元/API 30 项、前端 22 项、本地 Chromium 2 项、工作台 E2E 3 项，合计 57 项通过；类型/lint、生产构建、重复准备和锁文件一致性检查通过。详细命令与范围见 `docs/PROJECT_PLAN.md`。实际平台登录与购票流程未验证。

## 官方活动信息与已知限制

- [目标官方活动页](https://www.allticket.com/event/PlsLoveFanScreeningFinalEP)公开文字已于 2026-10-17 核实：**2026-10-18 11:00 Asia/Bangkok（GMT+7），即北京时间 12:00** 开售，网上和 7-Eleven 柜台同时开放。每单最多 4 张，禁止重复购买。
- 票价 2,500 / 2,000 / 1,500 / 900 THB，每张另收 30 THB 服务费及适用付款渠道费。7-Eleven 现金付款码须在 30 分钟内付款；此期限不能视作锁票时长。取票与退改等规则见 `docs/SALE_DAY_PLAN.md` 和 `docs/ALLTICKET_RESEARCH.md`。
- 参考活动官方地址已确认；其身份证专场和付款后 1 小时观众登记属于参考活动，不能套用到目标活动。
- 本次云端读到公开详情文字；图片/CDN 和部分验证资源仍受策略限制，系统 Chromium 原生访问有 CA 信任问题。公开文字通过保留 TLS 校验的转发读取，未验证正常登录、完整座位图、库存、排队和锁票机制。
- 发行包用于用户本地运行，仍需在本机确认图形浏览器、人工登录和官方最新完整规则；不内置倒计时、自动刷新或开售动作。

## Draft Release 交付

发布来源为 `release/v0.1.0-m2-preview` 专用分支。GitHub Release 保持 **draft=true、prerelease=true**，不公开发布；源码 ZIP 与 SHA256SUMS 由手动 GitHub Actions 工作流作为资产上传并回下载校验。云端直接上传曾返回 401，草稿创建成功不代表资产已就绪；实际工作流结果与资产状态以 GitHub 为准。草稿对有仓库相应权限的用户可见，具体结果见 `docs/PROJECT_PLAN.md`。

本次恢复验证：`npm run setup`、类型/lint、后端 30 项、前端 22 项、本地 Chromium 2 项、工作台 E2E 3 项以及生产构建均通过，共 57 项测试。浏览器自动测试均使用本地 fixture/模拟 API，不代表已验证真实购票。
