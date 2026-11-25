import { JSDOM } from 'jsdom'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost/meeting/test-room',
  pretendToBeVisual: true,
})
for (const key of [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'FormData',
  'Event',
  'HTMLElement',
  'MutationObserver',
  'CustomEvent',
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  })
// jsdom has no native dialog implementation. Browser focus trapping is native.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open')
}
// jsdom does not implement scrolling; keep exercising the real chat effect.
dom.window.HTMLElement.prototype.scrollIntoView = function () {}
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(predicate, desc) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await wait(30)
  }
  throw Error('Timeout: ' + desc + '\n' + document.body.textContent)
}
const button = (text) =>
  [...document.querySelectorAll('button')].find(
    (node) => node.textContent.trim() === text,
  )
const link = (text) =>
  [...document.querySelectorAll('a')].find(
    (node) => node.textContent.trim() === text,
  )
const body = () => document.body.textContent
async function enterPreview() {
  await until(() => button('Vào cuộc họp'), 'video preview before connection')
  assert.ok(
    document.querySelector('.preview-video'),
    'preview surface is visible',
  )
  assert.ok(
    document.querySelector('.preview-display-name input').readOnly,
    'display name cannot be edited',
  )
  assert.equal(
    document.querySelector('.meeting-shell'),
    null,
    'LiveKit room is not mounted before entry',
  )
  button('Vào cuộc họp').click()
}
const calls = []
let joinStatus = 'pending',
  listStatus = 200,
  joinStatusCode = 200
let shortNextToken = false
let guestMode = false
let guestLocked = false
let guestExpired = false
let profile = { id: 'self', name: 'Nguyễn Minh Anh', username: 'tester' }
let connectedRoom
const { Room, RoomEvent, ConnectionState } = await import('livekit-client')
const originalOn = Room.prototype.on
async function fakeConnect() {
  await wait(20)
  this.state = ConnectionState.Connected
  this.localParticipant.identity = guestMode ? 'guest-self' : 'self'
  this.localParticipant.name = guestMode ? 'Tên từ LiveKit' : 'Tên LiveKit'
  this.localParticipant.permissions = {
    canPublish: true,
    canPublishData: true,
    canPublishSources: [],
  }
  connectedRoom = this
  this.emit(RoomEvent.Connected)
  this.emit(RoomEvent.ConnectionStateChanged, ConnectionState.Connected)
}
async function fakeDisconnect() {
  this.state = ConnectionState.Disconnected
  this.emit(RoomEvent.Disconnected, 1)
  this.emit(RoomEvent.ConnectionStateChanged, ConnectionState.Disconnected)
}
// SDK stores connect/disconnect as instance fields; replace them when React
// subscribes to the room, before its connection effect runs. No sockets/media.
Room.prototype.on = function (...args) {
  this.connect = fakeConnect
  this.disconnect = fakeDisconnect
  return originalOn.apply(this, args)
}
const people = [
  {
    userId: 'self',
    name: 'Nguyễn Minh Anh',
    isGuest: false,
    role: 'host',
    canPublish: true,
    handRaisedAt: null,
  },
  {
    userId: 'other',
    name: 'Khách Lan',
    isGuest: true,
    role: 'participant',
    canPublish: true,
    handRaisedAt: null,
  },
  {
    userId: 'cohost',
    name: 'Đồng chủ trì An',
    isGuest: false,
    role: 'cohost',
    canPublish: true,
    handRaisedAt: null,
  },
]
const meeting = {
  id: 'test-room',
  title: 'Họp kiểm tra',
  myRole: 'host',
  status: 'active',
  hostId: 'self',
  createdAt: new Date().toISOString(),
  settings: {
    locked: false,
    waitingRoom: true,
    allowMicrophone: true,
    allowCamera: true,
    allowScreenShare: true,
    allowChat: true,
  },
  maxParticipants: 100,
}
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options })
  if (url === '/meeting-api/auth/login') {
    assert.deepEqual(JSON.parse(options.body), {
      username: 'tester',
      password: 'test-password',
    })
    return Response.json({
      accessToken: 'test-only',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'self', name: 'Nguyễn Minh Anh', username: 'tester' },
    })
  }
  if (url.endsWith('/guest')) {
    assert.equal(options.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(options.body), { name: 'Lan Nguyễn' })
    return Response.json({
      status: guestLocked ? 'locked' : 'pending',
      meeting,
      guest: guestLocked
        ? null
        : {
            id: 'guest-self',
            name: 'Lan Nguyễn',
            accessToken: 'guest-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
    })
  }
  assert.equal(
    options.headers.Authorization,
    guestMode ? 'Bearer guest-token' : 'Bearer test-only',
  )
  if (guestMode) {
    assert.ok(
      /^\/meeting-api\/meetings\/test-room(\/(join|room|hand))?$/.test(url),
      'guest requests stay within meeting APIs',
    )
    if (guestExpired)
      return Response.json({ message: 'Phiên khách hết hạn' }, { status: 401 })
  }
  if (url === '/meeting-api/auth/me') {
    if (options.method === 'PATCH') {
      const patch = JSON.parse(options.body)
      if (patch.password) assert.equal(patch.currentPassword, 'old-password')
      profile = { ...profile, name: patch.name }
    }
    return Response.json(profile)
  }
  if (url === '/meeting-api/users') {
    assert.deepEqual(JSON.parse(options.body), {
      name: 'Tài khoản mới',
      username: 'new.user',
      password: 'new-password',
    })
    return Response.json({
      id: 'new-user',
      name: 'Tài khoản mới',
      username: 'new.user',
    })
  }
  if (url === '/meeting-api/meetings' && options.method === 'POST') {
    assert.deepEqual(JSON.parse(options.body), {
      title: 'Họp mới',
      waitingRoom: true,
      maxParticipants: 100,
      coHostIds: ['cohost'],
    })
    return Response.json({
      status: 'admitted',
      meeting,
      token: 'created-token',
      serverUrl: 'ws://test.invalid',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      role: meeting.myRole,
    })
  }
  if (url.startsWith('/meeting-api/users?q='))
    return Response.json([
      { id: 'cohost', name: 'Đồng chủ trì An', username: 'an' },
    ])
  if (url.endsWith('/join')) {
    const result = Response.json(
      joinStatusCode === 200
        ? {
            status: joinStatus,
            meeting,
            ...(joinStatus === 'admitted'
              ? {
                  token: 'fake-token',
                  serverUrl: 'ws://test.invalid',
                  expiresAt: new Date(
                    Date.now() + (shortNextToken ? 31000 : 3600000),
                  ).toISOString(),
                  role: meeting.myRole,
                }
              : {}),
          }
        : {
            message:
              joinStatusCode === 404
                ? 'Cuộc họp không tồn tại'
                : 'Bạn không có quyền tham gia',
          },
      { status: joinStatusCode },
    )
    shortNextToken = false
    return result
  }
  if (url === '/meeting-api/meetings/test-room') {
    if (options.method === 'DELETE') meeting.status = 'ended'
    return Response.json(meeting)
  }
  if (url.endsWith('/room'))
    return Response.json({
      meeting,
      participants: people,
      lobbyCount: meeting.myRole === 'participant' ? null : 1,
    })
  if (url.endsWith('/members?status=pending'))
    return Response.json([
      {
        userId: 'pending-user',
        name: 'Khách Bình',
        isGuest: true,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        role: 'participant',
      },
    ])
  if (url.endsWith('/settings')) {
    Object.assign(meeting.settings, JSON.parse(options.body))
    return Response.json({
      settings: meeting.settings,
      admitted: [],
      applied: false,
    })
  }
  if (url.endsWith('/hand')) {
    people[0].handRaisedAt =
      options.method === 'POST' ? new Date().toISOString() : null
    return Response.json({
      userId: 'self',
      handRaisedAt: people[0].handRaisedAt,
    })
  }
  if (url.endsWith('/admit')) return Response.json({ applied: true })
  if (url === '/meeting-api/meetings')
    return Response.json(
      listStatus === 200 ? [meeting] : { message: 'Phiên đã hết hạn' },
      { status: listStatus },
    )
  throw Error('Unexpected path: ' + url)
}
// Test giả lập fetch tại /meeting-api: bỏ qua VITE_MEETING_API_URL từ shell hoặc file .env
// (trên server deploy file .env trỏ vào backend thật).
delete process.env.VITE_MEETING_API_URL
const vite = await createServer({
  root: process.cwd(),
  envDir: new URL('.', import.meta.url).pathname,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
})
let root
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
  root = createRoot(document.getElementById('root'))
  root.render(
    React.createElement(React.StrictMode, null, React.createElement(App)),
  )
  await until(() => body().includes('Đăng nhập'), 'login')
  link('Đăng nhập').click()
  await until(() => document.querySelector('[name=username]'), 'username form')
  document.querySelector('[name=username]').value = 'tester'
  document.querySelector('[name=password]').value = 'test-password'
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(
    () => body().includes('Bạn đang ở phòng chờ'),
    'pending after login return redirect',
  )
  assert.equal(window.location.pathname, '/meeting/test-room')
  const first = calls.filter((c) => c.url.endsWith('/join')).length
  await wait(4250)
  assert.ok(
    calls.filter((c) => c.url.endsWith('/join')).length > first,
    'pending should poll every 4 seconds',
  )
  button('Hủy chờ').click()
  await until(() => body().includes('Bạn đã rời cuộc họp'), 'cancel')
  const stopped = calls.length
  await wait(4250)
  assert.equal(calls.length, stopped, 'cancel must stop polling')
  link('Về trang chủ').click()
  await until(() => button('Cuộc họp mới'), 'home list')
  button('Cuộc họp mới').click()
  await until(() => document.querySelector('[name=title]'), 'create form')
  assert.equal(document.querySelector('[name=waitingRoom]').checked, true)
  assert.equal(
    document.activeElement,
    document.querySelector('[name=title]'),
    'title receives focus',
  )
  assert.ok(
    document.querySelector('dialog[open] .create-form'),
    'create form opens in dialog',
  )
  document.querySelector('[aria-label="Đóng hộp thoại"]').click()
  button('Tham gia').click()
  await until(
    () => document.querySelector('dialog[open] [name=invitation]'),
    'join opens in dialog',
  )
  assert.ok(document.querySelector('.home-clock time'), 'home includes a clock')
  assert.equal(
    document.querySelector('.welcome, .breadcrumb, .dashboard-footer'),
    null,
    'home has no marketing sections',
  )
  document.querySelector('[aria-label="Đóng hộp thoại"]').click()
  for (const [state, copy] of [
    ['denied', 'Yêu cầu tham gia bị từ chối'],
    ['kicked', 'Bạn đã bị mời ra'],
    ['locked', 'Cuộc họp đã bị khóa'],
  ]) {
    joinStatus = state
    const go = document.querySelector('a[href="/meeting/test-room"]')
    if (go) go.click()
    else button('Thử tham gia lại').click()
    await until(() => body().includes(copy), state)
    assert.equal(button('Thử tham gia lại').disabled, false)
  }
  joinStatusCode = 403
  button('Thử tham gia lại').click()
  await until(() => body().includes('Bạn không có quyền tham gia'), '403')
  joinStatusCode = 404
  button('Thử tham gia lại').click()
  await until(() => body().includes('Cuộc họp không tồn tại'), '404')
  link('Về trang chủ').click()
  await until(() => button('Cuộc họp mới'), 'back home')
  joinStatusCode = 200
  joinStatus = 'admitted'
  shortNextToken = true
  const beforePreviewJoin = calls.filter((call) =>
    call.url.endsWith('/join'),
  ).length
  document.querySelector('a[href="/meeting/test-room"]').click()
  await until(() => button('Vào cuộc họp'), 'admission enters preview')
  await until(
    () =>
      calls.filter((call) => call.url.endsWith('/join')).length >=
      beforePreviewJoin + 2,
    'token renewal continues during preview',
  )
  assert.equal(
    document.querySelector('.meeting-shell'),
    null,
    'renewal does not bypass preview',
  )
  await enterPreview()
  await until(
    () =>
      Boolean(document.querySelector('.admin-panel')) &&
      button('Bật tiếng') &&
      !button('Bật tiếng').disabled,
    'connected admin room',
  )
  assert.ok(
    body().includes('Khách Bình'),
    'waiting room is visible above the member list',
  )
  assert.equal(
    document.querySelector('.video-placeholder p').textContent,
    'Nguyễn Minh Anh',
    'camera off shows the full name',
  )
  assert.equal(
    document.querySelector('.video-placeholder > span'),
    null,
    'camera off has no large avatar',
  )
  assert.ok(
    document.querySelector('.tile-caption > span > .muted-mic + .tile-name'),
    'muted icon precedes name in caption chip',
  )
  assert.equal(
    document.querySelectorAll('.device-menu').length,
    2,
    'mic and camera each have a device menu',
  )
  assert.equal(
    document.querySelectorAll('.participants-list .participant-media').length,
    people.length,
    'each participant has mic and camera status',
  )
  document.querySelector('[aria-label="Thông tin cuộc họp"]').click()
  assert.ok(
    document.querySelector('.meeting-info').textContent.includes('test-room'),
    'information popover includes the full code',
  )
  document.querySelector('[aria-label="Thông tin cuộc họp"]').click()
  document.querySelector('[aria-label="Chuyển chế độ xem"]').click()
  button('Người nói').click()
  await until(() => document.querySelector('.speaker-stage'), 'speaker layout')
  const featuredName = document.querySelector(
    '.speaker-stage .tile-caption',
  ).textContent
  assert.ok(
    ![...document.querySelectorAll('.camera-grid .tile-caption')].some(
      (node) => node.textContent === featuredName,
    ),
    'featured speaker is excluded from thumbnails',
  )
  connectedRoom.activeSpeakers = [connectedRoom.localParticipant]
  connectedRoom.emit(
    RoomEvent.ActiveSpeakersChanged,
    connectedRoom.activeSpeakers,
  )
  await until(
    () => document.querySelector('.video-tile.is-speaking'),
    'active speaker highlight',
  )
  document.querySelector('[aria-label="Chuyển chế độ xem"]').click()
  button('Lưới').click()
  await until(() => !document.querySelector('.speaker-stage'), 'gallery layout')
  connectedRoom.emit(
    RoomEvent.DataReceived,
    new TextEncoder().encode(
      JSON.stringify({
        id: 'ui-chat',
        timestamp: Date.now(),
        message: 'Tin nhắn kiểm tra giao diện',
      }),
    ),
    connectedRoom.localParticipant,
    undefined,
    'lk-chat-topic',
  )
  await until(
    () => button('Trò chuyện').querySelector('.unread-dot'),
    'unread chat indicator',
  )
  button('Trò chuyện').click()
  await until(
    () => !document.querySelector('.chat-panel').hidden,
    'chat panel opens',
  )
  assert.equal(
    document.querySelector('.admin-panel'),
    null,
    'chat replaces people panel',
  )
  assert.ok(
    document
      .querySelector('.chat-messages')
      .textContent.includes('Tin nhắn kiểm tra giao diện'),
  )
  await until(
    () => !button('Trò chuyện').querySelector('.unread-dot'),
    'opening chat clears unread indicator',
  )
  assert.ok(
    document
      .querySelector('.chat-recipient')
      .textContent.includes('Gửi đến: Mọi người'),
  )
  let sentChat
  connectedRoom.localParticipant.sendText = async () => ({ id: 'ui-sent-chat' })
  connectedRoom.localParticipant.publishData = async (payload, options) => {
    sentChat = {
      text: new TextDecoder().decode(payload),
      topic: options.topic,
    }
  }
  const chatDraft = document.querySelector('#chat-draft')
  Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set.call(chatDraft, 'Gửi bằng Enter')
  chatDraft.dispatchEvent(new Event('input', { bubbles: true }))
  await until(() => !button('Gửi tin nhắn ↑').disabled, 'chat draft ready')
  chatDraft.dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  )
  await until(
    () => sentChat && chatDraft.value === '',
    'Enter sends chat and clears draft',
  )
  assert.equal(
    sentChat.topic,
    'lk-chat-topic',
    'chat retains the LiveKit topic',
  )
  assert.ok(sentChat.text.includes('Gửi bằng Enter'))
  document.querySelector('[aria-label="Đóng bảng bên"]').click()
  await until(
    () => document.querySelector('.chat-panel').hidden,
    'close side panel',
  )
  const peopleToggle = [...document.querySelectorAll('button')].find((node) =>
    node.textContent.includes('Người tham gia'),
  )
  peopleToggle.click()
  await until(
    () => document.querySelector('.admin-panel'),
    'reopen participants',
  )
  const entries = [...document.querySelectorAll('.participants-list>li')]
  assert.equal(
    entries[0].querySelectorAll('summary').length,
    0,
    'host cannot be moderated',
  )
  assert.ok(entries[1].textContent.includes('Mời ra khỏi phòng'))
  assert.ok(entries[1].textContent.includes('Khách Lan'))
  assert.ok(
    entries[1].querySelector('.role-badge').textContent.includes('Khách'),
  )
  assert.ok(!entries[1].textContent.includes('Cấp đồng chủ trì'))
  assert.ok(!entries[1].textContent.includes('Chuyển chủ trì'))
  assert.ok(body().includes('Nguyễn Minh Anh'))
  assert.ok(
    !entries[2].textContent.includes('Mời ra khỏi phòng'),
    'cohost must be demoted before kick',
  )
  assert.ok(
    !entries[2].textContent.includes('Khóa quyền phát'),
    'cohost cannot be publish locked',
  )
  connectedRoom.emit(
    RoomEvent.DataReceived,
    new TextEncoder().encode(
      JSON.stringify({
        type: 'join_requested',
        meetingId: 'test-room',
        userId: 'pending-user',
      }),
    ),
    undefined,
    undefined,
    'meeting.lobby',
  )
  await until(
    () => body().includes('Có người đang xin vào phòng họp.'),
    'lobby toast',
  )
  await until(
    () => body().includes('Phòng chờ (1)'),
    'lobby count synchronized',
  )
  button('Trò chuyện').click()
  await until(
    () => !document.querySelector('.chat-panel').hidden,
    'chat before lobby shortcut',
  )
  button('Xem').click()
  await until(() => button('Cho vào'), 'lobby')
  assert.ok(body().includes('Khách Bình'))
  const waitingGuest = [...document.querySelectorAll('.people-list li')].find(
    (node) => node.textContent.includes('Khách Bình'),
  )
  assert.equal(waitingGuest.querySelector('.role-badge').textContent, 'Khách')
  button('Cho vào').click()
  await until(
    () => calls.some((c) => c.url.endsWith('/members/pending-user/admit')),
    'admit endpoint',
  )
  button('Bảo mật').click()
  await until(() => document.querySelector('[role=switch]'), 'settings')
  assert.equal(
    document.querySelectorAll('.admin-panel .people-list').length,
    0,
    'settings contains no people or lobby',
  )
  assert.equal(
    document.querySelector('.end-section'),
    null,
    'end action is only in leave menu',
  )
  const micSwitch = [...document.querySelectorAll('.setting-row')]
    .find((n) => n.textContent === 'Cho phép bật mic')
    .querySelector('input')
  micSwitch.click()
  await until(
    () => body().includes('Thay đổi đã được lưu.'),
    'applied:false warning',
  )
  assert.ok(
    !button('Bật tiếng').disabled,
    'host is exempt from room microphone restriction',
  )
  meeting.myRole = 'participant'
  people[0].role = 'participant'
  connectedRoom.emit(
    RoomEvent.DataReceived,
    new TextEncoder().encode(
      JSON.stringify({
        type: 'role_changed',
        meetingId: 'test-room',
        userId: 'self',
        role: 'participant',
      }),
    ),
    undefined,
    undefined,
    'meeting.roles',
  )
  await until(
    () =>
      !document.querySelector('.admin-panel') && button('Bật tiếng').disabled,
    'realtime demotion disables restricted microphone',
  )
  assert.ok(!button('Bật video').disabled, 'allowed camera remains enabled')
  assert.equal(
    button('Bật tiếng').parentElement.title,
    'Chủ trì đã tắt tính năng này',
  )
  assert.ok(
    body().includes('Quyền của bạn đã được cập nhật.'),
    'permission change toast',
  )
  connectedRoom.emit(
    RoomEvent.TrackMuted,
    { source: 'microphone' },
    connectedRoom.localParticipant,
  )
  await until(
    () => body().includes('Mic của bạn đã được tắt.'),
    'microphone muted toast',
  )
  connectedRoom.localParticipant.permissions.canPublish = false
  connectedRoom.emit(
    RoomEvent.ParticipantPermissionsChanged,
    {},
    connectedRoom.localParticipant,
  )
  await until(
    () => button('Bật video').disabled,
    'SDK permission revoke disables camera',
  )
  connectedRoom.localParticipant.permissions.canPublish = true
  connectedRoom.emit(
    RoomEvent.ParticipantPermissionsChanged,
    {},
    connectedRoom.localParticipant,
  )
  await until(() => !button('Bật video').disabled, 'SDK permission restored')
  button('Giơ tay').click()
  await until(() => button('Hạ tay'), 'hand API updates')
  button('Hạ tay').click()
  await until(() => button('Giơ tay'), 'lower hand API updates')
  document.querySelector('[aria-label="Rời hoặc kết thúc cuộc họp"]').click()
  await until(() => body().includes('Bạn đã rời cuộc họp'), 'leave')
  joinStatus = 'admitted'
  button('Thử tham gia lại').click()
  await enterPreview()
  await until(
    () => button('Bật video') && !button('Bật video').disabled,
    'rejoin after leave',
  )
  joinStatus = 'kicked'
  connectedRoom.emit(RoomEvent.Disconnected, 4)
  await until(
    () => body().includes('Bạn đã bị mời ra'),
    'removed participant checks join status',
  )
  joinStatus = 'admitted'
  shortNextToken = true
  button('Thử tham gia lại').click()
  await enterPreview()
  await until(
    () => button('Bật video') && !button('Bật video').disabled,
    'short lived token connected',
  )
  const roomBeforeRenewal = connectedRoom
  const joinsBeforeRenewal = calls.filter((c) => c.url.endsWith('/join')).length
  await until(
    () =>
      connectedRoom !== roomBeforeRenewal &&
      body().includes('Kết nối đã được làm mới.'),
    'token renewed and connected with new room',
  )
  assert.ok(
    calls.filter((c) => c.url.endsWith('/join')).length > joinsBeforeRenewal,
  )
  roomBeforeRenewal.emit(RoomEvent.Disconnected, 5)
  await wait(50)
  assert.ok(
    document.querySelector('[aria-label="Rời hoặc kết thúc cuộc họp"]'),
    'old room disconnect must not close renewed room',
  )
  connectedRoom.emit(RoomEvent.Disconnected, 2)
  await until(
    () => body().includes('một cửa sổ hoặc thiết bị khác.'),
    'duplicate identity explanation',
  )
  button('Thử tham gia lại').click()
  await enterPreview()
  await until(
    () => button('Bật video') && !button('Bật video').disabled,
    'reconnect',
  )
  meeting.status = 'ended'
  connectedRoom.emit(RoomEvent.Disconnected, 5)
  await until(
    () => body().includes('Cuộc họp đã kết thúc'),
    'room deletion confirms ended',
  )
  listStatus = 401
  link('Về trang chủ').click()
  await until(
    () => body().includes('Phiên đăng nhập đã hết hạn.'),
    '401 logout',
  )
  assert.equal(localStorage.getItem('enterprise-meeting.session.v2'), null)

  // Account management and searchable cohost creation, using the real router/forms.
  listStatus = 200
  document.querySelector('[name=username]').value = 'tester'
  document.querySelector('[name=password]').value = 'test-password'
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(() => button('Cuộc họp mới'), 'login after expiry')
  document.querySelector('.account-menu summary').click()
  link('Tạo tài khoản').click()
  await until(() => document.querySelector('[name=name]'), 'new account form')
  document.querySelector('[name=name]').value = 'Tài khoản mới'
  document.querySelector('[name=username]').value = 'new.user'
  document.querySelector('[name=password]').value = 'new-password'
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(() => body().includes('Đã tạo tài khoản.'), 'create user success')
  document.querySelector('.account-menu summary').click()
  document.querySelector('a[href="/account"]').click()
  await until(() => body().includes('Tên đăng nhập: tester'), 'GET auth/me')
  document.querySelector('[name=name]').value = 'Tên mới'
  document.querySelector('[name=password]').value = 'new-password'
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(
    () => body().includes('Vui lòng nhập mật khẩu hiện tại'),
    'current password validation',
  )
  document.querySelector('[name=currentPassword]').value = 'old-password'
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(() => body().includes('Đã cập nhật tài khoản.'), 'PATCH auth/me')
  assert.equal(
    JSON.parse(localStorage.getItem('enterprise-meeting.session.v2')).user.name,
    'Tên mới',
  )
  listStatus = 200
  link('Về trang chủ').click()
  await until(() => button('Cuộc họp mới'), 'home for create')
  button('Cuộc họp mới').click()
  await until(
    () => body().includes('Đồng chủ trì An (an)'),
    'GET users search results',
  )
  const search = document.querySelector('fieldset input:not([type=checkbox])')
  Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set.call(search, 'An')
  search.dispatchEvent(new Event('input', { bubbles: true }))
  await until(
    () => calls.some((call) => call.url === '/meeting-api/users?q=An'),
    'search query',
  )
  document.querySelector('fieldset input[type=checkbox]').click()
  document.querySelector('[name=title]').value = 'Họp mới'
  meeting.status = 'active'
  meeting.myRole = 'host'
  people[0].role = 'host'
  joinStatus = 'admitted'
  const beforeCreateJoin = calls.filter((call) =>
    call.url.endsWith('/join'),
  ).length
  document
    .querySelector('form.create-form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await enterPreview()
  await until(
    () => document.querySelector('[aria-label="Rời hoặc kết thúc cuộc họp"]'),
    'create admission',
  )
  assert.equal(
    calls.filter((call) => call.url.endsWith('/join')).length,
    beforeCreateJoin,
    'creation uses its admission without join',
  )

  await until(
    () => button('Bật tiếng') && !button('Bật tiếng').disabled,
    'created room connected',
  )
  const endMenu = document.querySelector('.leave-options')
  const endToggle = endMenu.querySelector('summary')
  endToggle.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
  endToggle.click()
  assert.equal(endMenu.open, true)
  endToggle.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  assert.equal(endMenu.open, false, 'Escape closes leave menu')
  assert.equal(
    document.activeElement,
    endToggle,
    'Escape restores disclosure focus',
  )
  assert.equal(
    endMenu.dataset.focusOrigin,
    'pointer',
    'pointer-origin Escape suppresses the focus ring',
  )
  endToggle.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
  endToggle.click()
  endToggle.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  )
  assert.equal(endMenu.open, false, 'keyboard-origin Escape closes leave menu')
  assert.equal(
    endMenu.dataset.focusOrigin,
    undefined,
    'keyboard interaction restores the focus ring',
  )
  endMenu.querySelector('summary').click()
  document.body.dispatchEvent(
    new window.Event('pointerdown', { bubbles: true }),
  )
  assert.equal(endMenu.open, false, 'outside click closes leave menu')
  endMenu.querySelector('summary').click()
  button('Kết thúc cuộc họp cho mọi người').click()
  await until(
    () => document.querySelector('[role=alertdialog]'),
    'end confirmation',
  )
  assert.equal(
    calls.filter(
      (call) =>
        call.options.method === 'DELETE' &&
        call.url === '/meeting-api/meetings/test-room',
    ).length,
    0,
    'opening confirmation must not end',
  )
  button('Hủy').click()
  await until(() => !document.querySelector('[role=alertdialog]'), 'cancel end')
  document.querySelector('.leave-options summary').click()
  button('Kết thúc cuộc họp cho mọi người').click()
  await until(
    () => document.querySelector('[role=alertdialog]'),
    'end confirmation again',
  )
  button('Xác nhận').click()
  await until(
    () => body().includes('Cuộc họp đã kết thúc'),
    'confirmed end result',
  )
  assert.equal(
    calls.filter(
      (call) =>
        call.options.method === 'DELETE' &&
        call.url === '/meeting-api/meetings/test-room',
    ).length,
    1,
    'confirmed menu action sends exactly one DELETE meeting',
  )
  assert.equal(meeting.status, 'ended', 'mock backend receives the end action')

  // Reset the React root to represent a fresh anonymous browser visit.
  root.unmount()
  localStorage.clear()
  window.history.replaceState(null, '', '/meeting/test-room')
  root = createRoot(document.getElementById('root'))
  root.render(
    React.createElement(React.StrictMode, null, React.createElement(App)),
  )
  guestMode = true
  meeting.status = 'active'
  meeting.myRole = 'participant'
  joinStatus = 'pending'
  people.splice(0, people.length, {
    userId: 'guest-self',
    name: 'Lan Nguyễn',
    isGuest: true,
    role: 'participant',
    canPublish: true,
  })
  await until(() => button('Tham gia với tư cách khách'), 'anonymous choices')
  assert.equal(
    document.querySelector('a[href="/"]'),
    null,
    'guest cannot see homepage link',
  )
  button('Tham gia với tư cách khách').click()
  await until(() => document.querySelector('[name=name]'), 'guest name form')
  document.querySelector('[name=name]').value = 'Lan Nguyễn'
  guestLocked = true
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(
    () => body().includes('Cuộc họp đã bị khóa'),
    'locked guest response',
  )
  assert.equal(
    sessionStorage.getItem('guest:test-room'),
    null,
    'locked response has no token',
  )
  guestLocked = false
  document
    .querySelector('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await until(() => body().includes('Bạn đang ở phòng chờ'), 'guest pending')
  assert.equal(
    JSON.parse(sessionStorage.getItem('guest:test-room')).accessToken,
    'guest-token',
  )
  const guestJoins = calls.filter((call) => call.url.endsWith('/join')).length
  await wait(4250)
  assert.ok(
    calls.filter((call) => call.url.endsWith('/join')).length > guestJoins,
    'guest polls with its Bearer token',
  )
  joinStatus = 'admitted'
  await wait(4250)
  await enterPreview()
  await until(() => button('Rời'), 'guest admitted after polling')
  await until(
    () =>
      document
        .querySelector('.tile-caption')
        ?.textContent.includes('Lan Nguyễn'),
    'API display name',
  )
  assert.ok(
    document.querySelector('.tile-caption').textContent.includes('Lan Nguyễn'),
  )
  assert.equal(
    document.querySelector('.tile-caption .role-badge').textContent,
    'Khách',
  )
  assert.ok(
    document
      .querySelector('.people-list .role-badge')
      .textContent.includes('Khách'),
  )
  delete people[0].name
  connectedRoom.emit(
    RoomEvent.ParticipantAttributesChanged,
    {},
    connectedRoom.localParticipant,
  )
  await until(
    () =>
      document
        .querySelector('.tile-caption')
        .textContent.includes('Tên từ LiveKit'),
    'LiveKit name fallback',
  )
  people[0].name = 'Lan Nguyễn'
  connectedRoom.emit(
    RoomEvent.ParticipantAttributesChanged,
    {},
    connectedRoom.localParticipant,
  )
  await until(
    () =>
      document
        .querySelector('.tile-caption')
        .textContent.includes('Lan Nguyễn'),
    'API name priority',
  )
  assert.ok(!document.querySelector('.admin-panel'))
  button('Giơ tay').click()
  await until(() => button('Hạ tay'), 'guest hand uses guest token')
  joinStatus = 'kicked'
  connectedRoom.emit(RoomEvent.Disconnected, 4)
  await until(
    () => body().includes('Bạn đã bị mời ra'),
    'guest detail and join use guest token',
  )
  guestExpired = true
  button('Thử tham gia lại').click()
  await until(
    () => document.querySelector('[name=name]'),
    'guest 401 returns name form',
  )
  assert.equal(sessionStorage.getItem('guest:test-room'), null)
  assert.ok(body().includes('Phiên khách đã hết hạn'))

  // Guest tokens cannot authenticate account routes, even when stored.
  sessionStorage.setItem(
    'guest:test-room',
    JSON.stringify({ id: 'guest-self', accessToken: 'guest-token' }),
  )
  for (const path of ['/', '/account', '/users/new']) {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new window.PopStateEvent('popstate'))
    await until(
      () => window.location.pathname === '/login',
      'guest blocked from ' + path,
    )
    assert.ok(!button('Cuộc họp mới'))
  }
  window.history.pushState(null, '', '/meeting/another-room')
  window.dispatchEvent(new window.PopStateEvent('popstate'))
  await until(
    () => button('Tham gia với tư cách khách'),
    'guest token scoped to meeting',
  )
  assert.equal(sessionStorage.getItem('guest:another-room'), null)
  guestExpired = false
  joinStatus = 'pending'
  window.history.pushState(null, '', '/meeting/test-room')
  window.dispatchEvent(new window.PopStateEvent('popstate'))
  await until(
    () => body().includes('Bạn đang ở phòng chờ'),
    'stored guest token resumes join',
  )
  button('Hủy chờ').click()
  const afterGuestCancel = calls.length
  await wait(4250)
  assert.equal(
    calls.length,
    afterGuestCancel,
    'guest cancellation stops polling',
  )
  // Exercise preview permission boundaries and media lifecycle independently of sockets.
  root.unmount()
  const { default: MeetingPreview } = await vite.ssrLoadModule(
    '/src/components/MeetingPreview.jsx',
  )
  const { AuthContext } = await vite.ssrLoadModule('/src/auth/context.js')
  const { MemoryRouter } = await import('react-router-dom')
  let entered
  let stoppedTracks = 0
  let requested = []
  const makeStream = (kind) => {
    const track = {
      stop: () => {
        stoppedTracks++
      },
    }
    return {
      getTracks: () => [track],
      getVideoTracks: () => (kind === 'video' ? [track] : []),
      getAudioTracks: () => (kind === 'audio' ? [track] : []),
    }
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Micro thử nghiệm' },
        { kind: 'videoinput', deviceId: 'cam-1', label: 'Camera thử nghiệm' },
      ],
      getUserMedia: async (options) => {
        requested.push(options)
        return makeStream(options.video ? 'video' : 'audio')
      },
    },
  })
  function renderPreview(
    settings = {},
    token = 'opaque',
    role = 'participant',
  ) {
    root = createRoot(document.getElementById('root'))
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthContext.Provider,
          { value: { session: { user: profile }, identityId: 'self' } },
          React.createElement(MeetingPreview, {
            admission: {
              meeting: {
                ...meeting,
                settings: { ...meeting.settings, ...settings },
              },
              role,
              token,
            },
            onEnter: (choices) => {
              entered = choices
            },
            onLeave: () => {},
          }),
        ),
      ),
    )
  }
  renderPreview({ allowMicrophone: false, allowCamera: false })
  await until(() => button('Vào cuộc họp'), 'restricted preview')
  assert.ok(
    button('Bật tiếng').disabled && button('Bật video').disabled,
    'room restrictions disable preview controls',
  )
  button('Vào cuộc họp').click()
  assert.equal(entered.audio, false)
  assert.equal(entered.video, false)
  assert.equal(requested.length, 0, 'restricted preview never requests media')
  root.unmount()
  const grantToken =
    'x.' +
    Buffer.from(JSON.stringify({ video: { canPublish: false } })).toString(
      'base64url',
    ) +
    '.x'
  renderPreview({ allowMicrophone: true, allowCamera: true }, grantToken)
  await until(() => button('Vào cuộc họp'), 'token grant restrictions')
  assert.ok(
    button('Bật tiếng').disabled && button('Bật video').disabled,
    'token publish restrictions override available devices',
  )
  root.unmount()
  renderPreview({ allowMicrophone: true, allowCamera: true })
  await until(
    () => button('Bật video') && !button('Bật video').disabled,
    'media preview',
  )
  await until(
    () =>
      document.querySelector(
        '[aria-label="Chọn camera"] option[value="cam-1"]',
      ),
    'device list',
  )
  const cameraSelect = document.querySelector('[aria-label="Chọn camera"]')
  cameraSelect.value = 'cam-1'
  cameraSelect.dispatchEvent(new Event('change', { bubbles: true }))
  button('Bật video').click()
  await until(() => requested.length > 0, 'camera capture')
  assert.deepEqual(requested.at(-1), {
    video: { deviceId: { exact: 'cam-1' } },
  })
  await until(
    () => document.querySelector('.preview-video video').srcObject,
    'camera attaches to preview',
  )
  button('Bật tiếng').click()
  await until(
    () => requested.some((options) => options.audio),
    'microphone capture',
  )
  await wait(30)
  button('Vào cuộc họp').click()
  assert.equal(entered.audio, true, 'selected microphone is passed to room')
  assert.equal(entered.video, true, 'selected camera is passed to room')
  assert.equal(
    entered.videoDevice,
    'cam-1',
    'selected device is passed to room',
  )
  assert.ok(stoppedTracks >= 3, 'preview tracks stop on reconfigure and entry')
  root.unmount()
  navigator.mediaDevices.getUserMedia = async () => {
    throw new Error('NotAllowedError')
  }
  renderPreview({ allowMicrophone: true, allowCamera: true })
  await until(() => button('Bật video'), 'denied media preview')
  button('Bật video').click()
  await until(
    () => body().includes('Chưa truy cập được camera'),
    'permission error is nonblocking',
  )
  button('Vào cuộc họp').click()
  assert.equal(
    entered.video,
    false,
    'failed camera capture enters with camera off',
  )
  root.unmount()
  let finishCapture
  navigator.mediaDevices.getUserMedia = () =>
    new Promise((resolve) => {
      finishCapture = resolve
    })
  renderPreview({ allowCamera: true })
  await until(() => button('Bật video'), 'late capture preview')
  button('Bật video').click()
  await until(() => finishCapture, 'pending capture')
  root.unmount()
  const beforeLateStop = stoppedTracks
  finishCapture(makeStream('video'))
  await until(
    () => stoppedTracks > beforeLateStop,
    'late capture is stopped after unmount',
  )
  // A completed mic capture must stop even while a separate camera prompt is pending.
  let finishCamera
  navigator.mediaDevices.getUserMedia = (options) =>
    options.audio
      ? Promise.resolve(makeStream('audio'))
      : new Promise((resolve) => {
          finishCamera = resolve
        })
  renderPreview({ allowMicrophone: true, allowCamera: true })
  await until(() => button('Bật tiếng'), 'partial capture preview')
  button('Bật tiếng').click()
  await wait(30)
  button('Bật video').click()
  await until(() => finishCamera, 'camera pending while mic succeeds')
  await wait(30)
  const beforePartialStop = stoppedTracks
  root.unmount()
  assert.ok(
    stoppedTracks > beforePartialStop,
    'available mic stops without waiting for camera prompt',
  )
  const beforeCameraStop = stoppedTracks
  finishCamera(makeStream('video'))
  await until(
    () => stoppedTracks > beforeCameraStop,
    'pending camera stops when permission resolves',
  )
  console.log(
    'PASS React DOM: username login/return link; account create/update/current password; user search/cohost selection/create admission; guest name/locked/poll/admit/session resume/per-meeting tokens/401/route isolation; API names and guest badges in tiles/people/lobby; admin guest boundaries; gallery/speaker/highlight; panels/chat unread/lobby and permission toasts; settings/realtime/media permissions/hand; leave menu outside click/Escape/cancel/confirmed DELETE; leave/kick/token renewal including preview/ended/account 401; preview device selection, permission grants, denied capture, choices and track cleanup including late resolution; Enter chat submission.',
  )
} finally {
  root?.unmount()
  await vite.close()
  Room.prototype.on = originalOn
  dom.window.close()
}
