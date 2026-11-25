import { useEffect, useState } from 'react'
import { request } from '../api/client'
import { useAuth } from '../auth/context'
import { Notice } from './Common'

export default function CoHostPicker({ selected, onChange }) {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const result = await request(`/users?q=${encodeURIComponent(query.trim())}`, {
          token: session.accessToken,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setUsers(result)
          setError('')
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, session.accessToken])

  function remove(id) {
    onChange(selected.filter((item) => item.id !== id))
  }
  return (
    <fieldset className="cohost-picker">
      <legend>Đồng chủ trì</legend>
      <label>
        Tìm tài khoản
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập tên hoặc tên đăng nhập"
        />
      </label>
      <Notice>{error}</Notice>
      {loading && <p role="status">Đang tìm tài khoản…</p>}
      {!loading && !users.length && !error && <p>Không tìm thấy tài khoản.</p>}
      {selected.map((user) => (
        <button type="button" key={user.id} onClick={() => remove(user.id)}>
          {user.name} · Bỏ chọn
        </button>
      ))}
      {users.filter((user) => user.id !== session.user.id).map((user) => (
        <label className="check" key={user.id}>
          <input
            type="checkbox"
            checked={selected.some((item) => item.id === user.id)}
            onChange={(event) =>
              event.target.checked ? onChange([...selected, user]) : remove(user.id)
            }
          />
          {user.name} ({user.username})
        </label>
      ))}
    </fieldset>
  )
}
