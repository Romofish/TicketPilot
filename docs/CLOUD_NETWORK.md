# 云网络验证记录

更新日期：2026-10-17（Asia/Shanghai）。本次从 `release/v0.1.0-m2-preview` 恢复，新实例加载了包含目标域名的配置；以下替代此前旧实例的阻断结论。

## 配置与实际连通性

- 状态工具：`observations_current=true`、运行中；源配置版本 `cecfgver_6ad30982c310819b8ae300ce04500ad5`，规格版本 2。自定义列表包含 `www.allticket.com`、`allticket.com`、`api.github.com`、`uploads.github.com`；`network_policy.state=unknown`，不能声称运行时已报告 enforced。
- `/etc/codex/network-policy.json` 为 version 1、restricted，包含上述域名和包管理器预设；`vpn_configured=false`，没有 TCP grants。本次未编辑策略、移除代理或关闭 TLS 校验。
- 默认命令沙箱连代理端口失败。对必要命令授予 network 权限后，经原代理 Git 拉取成功、目标活动 HEAD 200、`gh api user` 确认账号 Romofish、仓库 API 确认 push/admin 权限、`uploads.github.com` HEAD 返回 302。该事实证明已测试路径可用，不代表所有域名或完整网页功能可用。
- Chromium 原生 HTTPS 出现 `ERR_CERT_AUTHORITY_INVALID`。本次公开文字研究改用系统 CA 校验的 HTTPX 经原代理转发公开 GET，在临时无头 Chromium 中渲染；不修改系统信任、不禁用 TLS、不记录报文/登录态。此路径用于读取公开公告，不能宣称应用的正常浏览器流程已经验证。
- 页面所需 `atkmedia.allticket.com` 图片、AWS WAF SDK/captcha、Google 等资源被代理拒绝；未绕过，未新增域名，也未验证登录、座位图或购票。如果今后要从云端验证完整页面，需根据实际拒绝资源补充允许域名并解决浏览器 CA 信任；本次用户本地运行交付无需新增云端桌面。

## GitHub Draft Release

CLI 认证与草稿创建已通过，Release ID 为 415622865，draft/prerelease 均为 true。但直接上传向 uploads.github.com 返回 401 Bad credentials；尚不能认定上传认证就绪。改用仓库内手动 GitHub Actions 标准 GITHUB_TOKEN 打包上传并回下载校验，不提取或转移云端注入凭据。实际结果见 `PROJECT_PLAN.md`；本地打包或 Git 推送本身不等于草稿成功。不得打印凭据或真实 `.env`。

## 历史说明

此前旧实例自定义列表为空，对官网和 GitHub API 的 CONNECT 返回 403，只能说明当时的访问被阻断，不能推断网站状态或凭据无效。本次实测已经消除 GitHub 发布路径和官网公开文字读取的阻断，完整页面资源仍受上述限制。
