export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError('无法连接后端。请确认 FastAPI 服务已启动。', 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `请求失败（${response.status}），请稍后重试。`;
    throw new ApiError(detail, response.status);
  }
  return data as T;
}
export function post<T>(path: string, body?: unknown) {
  return api<T>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
}
export function validateActivityUrl(value: string, platform: 'allticket' | 'ttm'): string | null {
  if (/[\s\\]/.test(value.trim())) return '活动链接不能包含空白字符或反斜杠。';
  let url: URL;
  try { url = new URL(value.trim()); } catch { return '请输入完整的活动 URL，例如 https://www.allticket.com/event/…'; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    return '请使用不含账号、密码和自定义端口的 HTTPS 活动链接。';
  }
  const domain = platform === 'allticket' ? 'allticket.com' : 'thaiticketmajor.com';
  if (url.hostname !== domain && url.hostname !== `www.${domain}`) {
    return `当前平台仅接受 ${domain} 官方域名的活动链接。`;
  }
  return null;
}
