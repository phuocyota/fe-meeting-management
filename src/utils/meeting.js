export const roleLabels = {
  host: 'Chủ trì',
  cohost: 'Đồng chủ trì',
  participant: 'Người tham gia',
}
export const isAdmin = (role) => role === 'host' || role === 'cohost'
export const memberPath = (userId, action) =>
  `/members/${encodeURIComponent(userId)}/${action}`

export function participantActions(myRole, myId, participant) {
  if (
    !isAdmin(myRole) ||
    participant.userId === myId ||
    participant.role === 'host'
  )
    return []
  const actions = ['mute', 'camera']
  if (!participant.isGuest) actions.push('cohost')
  if (participant.handRaisedAt) actions.push('hand')
  if (participant.role !== 'cohost') actions.push('publish', 'kick')
  if (myRole === 'host' && !participant.isGuest) actions.push('host')
  return actions
}

export function meetingIdFromInput(input) {
  const value = input.trim()
  if (!value) throw new Error('Vui lòng nhập mã hoặc link cuộc họp.')
  let id = value
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    let url
    try {
      url = value.startsWith('/')
        ? new URL(value, window.location.origin)
        : new URL(value)
    } catch {
      throw new Error('Link cuộc họp không hợp lệ.')
    }
    const match = url.pathname.match(/^\/meeting\/([^/]+)\/?$/)
    if (!match) throw new Error('Link phải có dạng /meeting/:id.')
    id = decodeURIComponent(match[1])
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new Error('Mã cuộc họp không hợp lệ.')
  return id
}

export function metadataRole(metadata) {
  try {
    const role = JSON.parse(metadata || '{}').role
    return Object.hasOwn(roleLabels, role) ? role : null
  } catch {
    return null
  }
}

export function meetingErrorStatus(error) {
  if (error.status !== 404) return 'error'
  return /không tồn tại/i.test(error.message) ? 'missing' : 'ended'
}
