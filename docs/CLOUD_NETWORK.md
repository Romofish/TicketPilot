# 当前云网络阻断与修复

记录日期：2026-10-17（Asia/Shanghai）。当前代理策略为 restricted，观测状态为 enforced，自定义 allowed_hosts 为空，仅启用 package_managers 预设。

## 已观察到的结果

- 对用户提供的 ALL TICKET 目标活动发出一次 HEAD 请求，代理在 CONNECT 阶段返回 HTTP 403。尚未到达平台，不能解释成平台封禁或活动不可用。
- `gh api user` 对 `api.github.com` 返回 Forbidden。网络尚不通，不能据此判定 CLI Token 是否有效。
- GitHub 连接器能够访问 `Romofish/TicketPilot` 并确认 push/admin 权限；Git 远程读取可用。连接器权限和云端 CLI 凭据是不同的访问通道。

## 待应用的最小配置

在当前云环境的网络允许列表保留已有包管理器预设，增加：

```text
www.allticket.com
allticket.com
api.github.com
uploads.github.com
```

保存并应用到当前环境。第一个平台地址来自用户提供的活动链接；根域名供官方跳转使用。GitHub 两个域名分别用于 API 和 Release 资产上传。若后续正常页面加载显示其他 CDN/登录域名受阻，再根据实际证据补充。

本会话可用的云环境工具只有状态读取，没有网络策略写接口，所以这一步需要用户在云环境配置界面完成。不要编辑 `/etc/codex/network-policy.json`：它是运行时策略快照，编辑不能授予网络访问。不要关闭 TLS 校验、移除代理或绕过侧车。

## 应用后的验收

1. 读取云环境状态，确认 observations_current=true、network_policy.state=enforced，effective_allowed_hosts 包含新增域名。
2. 对活动 URL 进行一次保守公开访问，记录官方页面或实际平台返回的状态；不点击座位、确认订单或支付。
3. 执行 `gh api user` 检查 CLI 认证，然后创建 Draft Release 并上传本地源码 ZIP 与 SHA256SUMS。
4. 若出现真实的认证错误，再按具体错误补充仓库范围的发布凭据；当前尚无证据要求用户提供新密钥。凭据不得贴入聊天、代码或日志。

本机使用不依赖这台云环境的网络允许列表。该配置只影响云端官方页面研究与 GitHub CLI 发布。
