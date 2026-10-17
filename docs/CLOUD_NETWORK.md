# 云网络验证记录

更新日期：2026-10-17（Asia/Shanghai）。各轮观测的环境配置与结果不同，以下按记录范围区分。

## 本轮追加验证：域名配置已生效

- 当前 `observations_current=true`、`observed_phase=running`、`network_policy.state=enforced`，规格版本与观测版本均为 2。配置版本为 `cecfgver_6ad31951f8f0819b9664224a44acb71c`。
- 生效自定义域名包含 `allticket.com`、`www.allticket.com`、`atkmedia.allticket.com`、两个已配置的 AWS WAF SDK/captcha 主机、`cdnjs.cloudflare.com`、`fonts.googleapis.com`、`www.google.com` 以及 GitHub API/上传主机。配置存在不等于所有页面功能已验证。
- 通过命令级 network 权限、继承代理与正常 TLS 校验，官网首页实际返回 HTTP 200，公开脚本和目标座区海报可读取。默认命令沙箱的 Operation not permitted 是命令权限层，与域名名单分开。
- 当前没有可调用的交互式 Browser/CUA 工具，也没有用户已登录会话；没有重试旧的真实浏览器流程、修改 CA 或关闭 TLS。此前 Chromium 证书问题仍为历史待验证项，不能仅因域名补齐就声称已解决。
- 官方当前售票状态读取未成功，详细 HTTP 结果与范围见 [本轮流程证据](ALLTICKET_FLOW_EVIDENCE.md)。未尝试绕过失败或重放购票请求。
- 本轮仅开发和本地验证应用；未修改 GitHub 草稿或上传新版资产。

## 前轮配置与实际连通性（历史）

- 状态工具：`observations_current=true`、运行中；源配置版本 `cecfgver_6ad30982c310819b8ae300ce04500ad5`，规格版本 2。自定义列表包含 `www.allticket.com`、`allticket.com`、`api.github.com`、`uploads.github.com`；`network_policy.state=unknown`，不能声称运行时已报告 enforced。
- `/etc/codex/network-policy.json` 为 version 1、restricted，包含上述域名和包管理器预设；`vpn_configured=false`，没有 TCP grants。本次未编辑策略、移除代理或关闭 TLS 校验。
- 默认命令沙箱连代理端口失败。对必要命令授予 network 权限后，经原代理 Git 拉取成功、目标活动 HEAD 200、`gh api user` 确认账号 Romofish、仓库 API 确认 push/admin 权限、`uploads.github.com` HEAD 返回 302。该事实证明已测试路径可用，不代表所有域名或完整网页功能可用。
- Chromium 原生 HTTPS 出现 `ERR_CERT_AUTHORITY_INVALID`。本次公开文字研究改用系统 CA 校验的 HTTPX 经原代理转发公开 GET，在临时无头 Chromium 中渲染；不修改系统信任、不禁用 TLS、不记录报文/登录态。此路径用于读取公开公告，不能宣称应用的正常浏览器流程已经验证。
- 页面所需 `atkmedia.allticket.com` 图片、AWS WAF SDK/captcha、Google 等资源被代理拒绝；未绕过，未新增域名，也未验证登录、座位图或购票。如果今后要从云端验证完整页面，需根据实际拒绝资源补充允许域名并解决浏览器 CA 信任；本次用户本地运行交付无需新增云端桌面。

## GitHub Draft Release

CLI 认证与草稿创建已通过，Release ID 为 415622865，draft/prerelease 均为 true。但直接上传向 uploads.github.com 返回 401 Bad credentials；尚不能认定上传认证就绪。改用仓库内手动 GitHub Actions 标准 GITHUB_TOKEN 打包上传并回下载校验，不提取或转移云端注入凭据。Actions 执行 39009442651 已成功上传两个资产并回下载校验，草稿保持未发布；最终来源与后续刷新结果见 `PROJECT_PLAN.md` 和 Release 元数据；本地打包或 Git 推送本身不等于草稿成功。不得打印凭据或真实 `.env`。

## 历史说明

此前旧实例自定义列表为空，对官网和 GitHub API 的 CONNECT 返回 403，只能说明当时的访问被阻断，不能推断网站状态或凭据无效。本次实测已经消除 GitHub 发布路径和官网公开文字读取的阻断，完整页面资源仍受上述限制。
