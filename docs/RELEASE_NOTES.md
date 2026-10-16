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

## 已知限制与发布状态

- 当前云端对 ALL TICKET 的 HEAD 访问在代理 CONNECT 阶段返回 HTTP 403，未到达官网；没有获得真实页面结构、库存或锁票规则证据。人工登录及目标活动流程须在用户本地验证。
- 用户报告开售为“明天泰国时间 11:00”；按 2026-10-17 客户端日期解释为 2026-10-18 泰国 11:00／上海 12:00，官方日程尚未核实。
- 参考活动链接末尾分号暂按标点去除，原始输入仍在研究文档中，规范化候选地址未验证。
- GitHub Draft Release 为用户要求的交付形式。当前 `api.github.com` 云网络访问受阻，GitHub 认证与上传权限尚未验证；本地 ZIP 生成不代表已经创建发布草稿。创建与上传需要云网络允许 `api.github.com`、`uploads.github.com`。真实平台云端研究另需 `www.allticket.com`；未修改任何基础配置。
