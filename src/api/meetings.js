import { request } from './client'

export function meetingApi(token) {
  const call = (path = '', options) =>
    request(`/meetings${path}`, { token, ...options })
  const roomPath = (id) => `/${encodeURIComponent(id)}`
  return {
    guest: (id, name) => call(`${roomPath(id)}/guest`, { method: 'POST', body: { name } }),
    list: (signal) => call('', { signal }),
    create: (body) => call('', { method: 'POST', body }),
    detail: (id, signal) => call(roomPath(id), { signal }),
    join: (id, signal) =>
      call(`${roomPath(id)}/join`, { method: 'POST', signal }),
    room: (id, signal) => call(`${roomPath(id)}/room`, { signal }),
    lobby: (id, signal) =>
      call(`${roomPath(id)}/members?status=pending`, { signal }),
    action: (id, path, method = 'POST', body) =>
      call(`${roomPath(id)}${path}`, { method, body }),
  }
}
