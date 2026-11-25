const base = import.meta.env?.VITE_MEETING_API_URL || '/meeting-api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorMessage(
  body,
  fallback = 'Yêu cầu thất bại. Vui lòng thử lại.',
) {
  return Array.isArray(body?.message)
    ? body.message.join('\n')
    : body?.message || fallback
}

export async function request(
  path,
  { token, body, method = 'GET', signal } = {},
) {
  let response
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(
      'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
      0,
    )
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: token }))
    }
    throw new ApiError(
      errorMessage(payload, `Máy chủ trả lỗi (${response.status}).`),
      response.status,
    )
  }
  return payload
}
