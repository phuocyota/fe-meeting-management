import { useCallback } from 'react'
import { useAuth } from '../auth/context'

export function useDisplayName() {
  const { session } = useAuth()
  return useCallback(
    (userId, participant, member) => {
      if (member?.name?.trim()) return member.name.trim()
      if (participant?.name?.trim()) return participant.name.trim()
      if (userId === session?.user.id && session.user.name) return session.user.name
      const id = String(userId || '')
      return id
        ? `Thành viên ${id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id}`
        : 'Thành viên'
    },
    [session],
  )
}
