import test from 'node:test'
import assert from 'node:assert/strict'
import {
  participantActions,
  meetingIdFromInput,
  metadataRole,
  meetingErrorStatus,
} from '../src/utils/meeting.js'
import { ApiError, errorMessage, request } from '../src/api/client.js'

test('role boundaries: host is protected, cohost must be demoted before kick/publish lock', () => {
  const person = {
    userId: 'other',
    role: 'participant',
    handRaisedAt: '2026-11-25T00:00:00Z',
  }
  assert.deepEqual(participantActions('participant', 'me', person), [])
  assert.deepEqual(
    participantActions('host', 'me', { ...person, userId: 'me' }),
    [],
  )
  assert.deepEqual(
    participantActions('cohost', 'me', { ...person, role: 'host' }),
    [],
  )
  const cohostActions = participantActions('host', 'me', {
    ...person,
    role: 'cohost',
  })
  assert.ok(!cohostActions.includes('kick'))
  assert.ok(!cohostActions.includes('publish'))
  assert.ok(cohostActions.includes('cohost'))
  assert.ok(cohostActions.includes('host'))
  assert.ok(!participantActions('cohost', 'me', person).includes('host'))
  assert.ok(participantActions('host', 'me', person).includes('kick'))
  const guestActions = participantActions('host', 'me', { ...person, isGuest: true })
  assert.ok(!guestActions.includes('cohost'))
  assert.ok(!guestActions.includes('host'))
  assert.ok(guestActions.includes('kick'))
})

test('invitation parser accepts meeting code and link, rejects unrelated paths and encoded path injection', () => {
  assert.equal(meetingIdFromInput(' abc-123 '), 'abc-123')
  assert.equal(
    meetingIdFromInput('https://meet.example/meeting/abc-123?utm=invite'),
    'abc-123',
  )
  assert.throws(() => meetingIdFromInput('https://meet.example/settings'))
  assert.throws(() =>
    meetingIdFromInput('https://meet.example/meeting/abc%2Fsettings'),
  )
  assert.throws(() => meetingIdFromInput(''))
})

test('metadata parsing tolerates malformed JSON but only accepts contract roles', () => {
  assert.equal(metadataRole('{"role":"cohost"}'), 'cohost')
  assert.equal(metadataRole('{"role":"owner"}'), null)
  assert.equal(metadataRole('{'), null)
})

test('NestJS validation errors keep all Vietnamese messages', () => {
  assert.equal(
    errorMessage({
      message: ['Tiêu đề không được trống', 'Số người không hợp lệ'],
    }),
    'Tiêu đề không được trống\nSố người không hợp lệ',
  )
})

test('fetch boundary uses direct meeting responses, carries Bearer token, handles 204, expiry and network errors', async (t) => {
  let received
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    received = { url, options }
    return Response.json({ accessToken: 'test-token' })
  })
  const login = await request('/auth/login', {
    method: 'POST',
    body: { username: 'tester', password: 'test-only' },
  })
  assert.equal(login.accessToken, 'test-token')
  assert.equal(received.url, '/meeting-api/auth/login')
  assert.equal(received.options.headers['Content-Type'], 'application/json')
  globalThis.fetch.mock.mockImplementation(async () =>
    Response.json({ status: 'pending', meeting: { id: 'one' } }),
  )
  assert.deepEqual(
    await request('/meetings/one/join', {
      token: 'test-token',
      method: 'POST',
    }),
    { status: 'pending', meeting: { id: 'one' } },
  )
  globalThis.fetch.mock.mockImplementation(async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    return new Response(null, { status: 204 })
  })
  assert.equal(
    await request('/meetings/one', {
      token: 'test-token',
      method: 'DELETE',
    }),
    null,
  )
  let expired = false
  const originalWindow = globalThis.window
  globalThis.window = {
    dispatchEvent: () => {
      expired = true
    },
  }
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  })
  globalThis.fetch.mock.mockImplementation(async () =>
    Response.json({ message: 'Phiên đã hết hạn' }, { status: 401 }),
  )
  await assert.rejects(
    request('/meetings', { token: 'expired' }),
    (error) => error instanceof ApiError && error.status === 401,
  )
  assert.equal(expired, true)
  globalThis.fetch.mock.mockImplementation(async () => {
    throw new TypeError('fetch failed')
  })
  await assert.rejects(
    request('/meetings'),
    (error) => error.status === 0,
  )
})

test('404 distinguishes a missing meeting from an ended meeting', () => {
  assert.equal(
    meetingErrorStatus({ status: 404, message: 'Cuộc họp không tồn tại' }),
    'missing',
  )
  assert.equal(
    meetingErrorStatus({ status: 404, message: 'Cuộc họp đã kết thúc' }),
    'ended',
  )
  assert.equal(
    meetingErrorStatus({ status: 403, message: 'Không có quyền' }),
    'error',
  )
})
