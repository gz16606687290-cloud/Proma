/**
 * URL 规范化工具
 *
 * 各供应商 Base URL 的规范化处理。
 */

/**
 * 规范化 Anthropic Base URL
 *
 * 去除尾部斜杠，如果没有版本路径则追加 /v1。
 * 特殊处理：字节跳动 Coding Plan 的 URL 不自动添加 /v1
 * 例如：
 * - "https://api.anthropic.com" → "https://api.anthropic.com/v1"
 * - "https://api.anthropic.com/v1" → 不变
 * - "https://proxy.example.com/v2/" → "https://proxy.example.com/v2"
 * - "https://ark.cn-beijing.volces.com/api/coding" → 不变（字节跳动 Coding Plan）
 */
export function normalizeAnthropicBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '')
  
  if (url.includes('/api/coding')) {
    return url
  }
  
  if (!url.match(/\/v\d+$/)) {
    url = `${url}/v1`
  }
  return url
}

/**
 * 规范化通用 Base URL
 *
 * 仅去除尾部斜杠，适用于 OpenAI / Google 等。
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}
