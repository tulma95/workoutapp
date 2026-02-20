import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFriends,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '../api/social'
import type { Friend, FriendRequest } from '../api/social'
import { SkeletonLine, SkeletonCard } from './Skeleton'
import styles from './FriendsTab.module.css'

export function FriendsTab() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState('')

  const friendsQuery = useQuery({
    queryKey: ['social', 'friends'],
    queryFn: getFriends,
  })

  const requestsQuery = useQuery({
    queryKey: ['social', 'friend-requests'],
    queryFn: getFriendRequests,
  })

  const acceptMutation = useMutation({
    mutationFn: (id: number) => acceptFriendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'friends'] })
    },
  })

  const declineMutation = useMutation({
    mutationFn: (id: number) => declineFriendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'friends'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeFriend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social', 'friends'] })
      queryClient.invalidateQueries({ queryKey: ['social', 'leaderboard'] })
    },
  })

  const sendMutation = useMutation({
    mutationFn: (emailAddress: string) => sendFriendRequest(emailAddress),
    onSuccess: () => {
      setEmail('')
      setSendError('')
      setSendSuccess(true)
    },
    onError: (err: Error) => {
      setSendSuccess(false)
      setSendError(err.message || 'Something went wrong')
    },
  })

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSendSuccess(false)
    setSendError('')
    const trimmed = email.trim()
    if (!trimmed) return
    sendMutation.mutate(trimmed)
  }

  const isLoading = friendsQuery.isLoading || requestsQuery.isLoading

  if (isLoading) {
    return (
      <div className={styles.container}>
        <SkeletonCard>
          <SkeletonLine width="40%" height="1rem" />
          <SkeletonLine width="100%" height="3rem" />
          <SkeletonLine width="30%" height="3rem" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonLine width="50%" height="1rem" />
          <SkeletonLine width="100%" height="3.5rem" />
          <SkeletonLine width="100%" height="3.5rem" />
        </SkeletonCard>
      </div>
    )
  }

  const friends: Friend[] = friendsQuery.data?.friends ?? []
  const requests: FriendRequest[] = requestsQuery.data?.requests ?? []

  return (
    <div className={styles.container}>
      <section className={styles.section} aria-labelledby="send-request-heading">
        <h3 id="send-request-heading" className={styles.sectionHeading}>
          Add Friend
        </h3>
        <form onSubmit={handleSend} className={styles.sendForm} noValidate>
          <label htmlFor="friend-email" className={styles.label}>
            Friend's email address
          </label>
          <div className={styles.sendRow}>
            <input
              id="friend-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSendSuccess(false)
                setSendError('')
              }}
              aria-describedby={
                sendSuccess
                  ? 'send-success'
                  : sendError
                  ? 'send-error'
                  : undefined
              }
              aria-invalid={sendError ? 'true' : undefined}
              disabled={sendMutation.isPending}
              className={styles.emailInput}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={sendMutation.isPending || !email.trim()}
            >
              {sendMutation.isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
          {sendSuccess && (
            <p id="send-success" className={styles.successMsg} role="status">
              Friend request sent!
            </p>
          )}
          {sendError && (
            <p id="send-error" className={styles.errorMsg} role="alert">
              {sendError}
            </p>
          )}
        </form>
      </section>

      {requests.length > 0 && (
        <section className={styles.section} aria-labelledby="requests-heading">
          <h3 id="requests-heading" className={styles.sectionHeading}>
            Pending Requests
          </h3>
          <ul className={styles.list} aria-label="Pending friend requests">
            {requests.map((req) => (
              <li key={req.id} className={styles.listItem}>
                <span className={styles.displayName}>{req.displayName}</span>
                <div className={styles.actions}>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => acceptMutation.mutate(req.id)}
                    disabled={
                      acceptMutation.isPending &&
                      acceptMutation.variables === req.id
                    }
                    aria-label={`Accept friend request from ${req.displayName}`}
                  >
                    Accept
                  </button>
                  <button
                    className={styles.declineBtn}
                    onClick={() => declineMutation.mutate(req.id)}
                    disabled={
                      declineMutation.isPending &&
                      declineMutation.variables === req.id
                    }
                    aria-label={`Decline friend request from ${req.displayName}`}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby="friends-heading">
        <h3 id="friends-heading" className={styles.sectionHeading}>
          Friends
        </h3>
        {friends.length === 0 ? (
          <p className={styles.emptyMsg}>No friends yet.</p>
        ) : (
          <ul className={styles.list} aria-label="Friends list">
            {friends.map((friend) => (
              <li key={friend.id} className={styles.listItem}>
                <span className={styles.displayName}>{friend.displayName}</span>
                {friend.streak >= 2 && (
                  <span className={styles.streakBadge}>{friend.streak} day streak</span>
                )}
                <button
                  className={styles.removeBtn}
                  onClick={() => removeMutation.mutate(friend.id)}
                  disabled={
                    removeMutation.isPending &&
                    removeMutation.variables === friend.id
                  }
                  aria-label={`Remove ${friend.displayName} from friends`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
