import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFriends,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  sendFriendRequestByUsername,
  searchUsers,
} from '../api/social'
import type { Friend, FriendRequest, UserSearchResult } from '../api/social'
import { SkeletonLine, SkeletonCard } from './Skeleton'
import styles from './FriendsTab.module.css'

type SendMode = 'search' | 'email'

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err !== null && typeof err === 'object' && 'error' in err) {
    const e = (err as { error: unknown }).error
    if (e !== null && typeof e === 'object') {
      if ('code' in e) {
        const code = (e as { code: string }).code
        if (code === 'NOT_FOUND') return 'User not found'
        if (code === 'ALREADY_FRIEND') return 'Already friends'
        if (code === 'ALREADY_REQUESTED') return 'Friend request already pending'
      }
      if ('message' in e && typeof (e as { message: unknown }).message === 'string') {
        return (e as { message: string }).message
      }
    }
  }
  return fallback
}

export function FriendsTab() {
  const queryClient = useQueryClient()

  const [sendMode, setSendMode] = useState<SendMode>('search')
  const [email, setEmail] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState('')
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchQuery.length === 0) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userSearchQuery = useQuery({
    queryKey: ['social', 'search', debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
  })

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

  const sendByEmailMutation = useMutation({
    mutationFn: (emailAddress: string) => sendFriendRequest(emailAddress),
    onSuccess: () => {
      setEmail('')
      setSendError('')
      setSendSuccess(true)
    },
    onError: (err: unknown) => {
      setSendSuccess(false)
      setSendError(extractErrorMessage(err, 'Something went wrong'))
    },
  })

  const sendByUsernameMutation = useMutation({
    mutationFn: (username: string) => sendFriendRequestByUsername(username),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['social', 'search'] })
      setSearchQuery('')
      setDebouncedQuery('')
      setSendError('')
      setSendSuccess(true)
      setShowDropdown(false)
    },
    onError: (err: unknown) => {
      setSendSuccess(false)
      setSendError(extractErrorMessage(err, 'Something went wrong'))
    },
  })

  function handleSendByEmail(e: React.FormEvent) {
    e.preventDefault()
    setSendSuccess(false)
    setSendError('')
    const trimmed = email.trim()
    if (!trimmed) return
    sendByEmailMutation.mutate(trimmed)
  }

  function handleSelectUser(user: UserSearchResult) {
    setShowDropdown(false)
    setSendSuccess(false)
    setSendError('')
    if (user.username) {
      sendByUsernameMutation.mutate(user.username)
    }
  }

  function handleSwitchMode(mode: SendMode) {
    setSendMode(mode)
    setSendSuccess(false)
    setSendError('')
    setSearchQuery('')
    setDebouncedQuery('')
    setShowDropdown(false)
    setEmail('')
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
  const searchResults: UserSearchResult[] = userSearchQuery.data?.users ?? []
  const isSearching = userSearchQuery.isFetching

  return (
    <div className={styles.container}>
      <section className={styles.section} aria-labelledby="send-request-heading">
        <h3 id="send-request-heading" className={styles.sectionHeading}>
          Add Friend
        </h3>

        <div className={styles.modeToggle} role="group" aria-label="Friend request method">
          <button
            type="button"
            className={sendMode === 'search' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
            onClick={() => handleSwitchMode('search')}
            aria-pressed={sendMode === 'search'}
          >
            Search by username
          </button>
          <button
            type="button"
            className={sendMode === 'email' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
            onClick={() => handleSwitchMode('email')}
            aria-pressed={sendMode === 'email'}
          >
            Send by email
          </button>
        </div>

        {sendMode === 'search' ? (
          <div className={styles.searchSection}>
            <label htmlFor="user-search" className={styles.label}>
              Search by username
            </label>
            <div ref={searchContainerRef} className={styles.searchContainer}>
              <input
                id="user-search"
                type="search"
                autoComplete="off"
                placeholder="Type a username..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchQuery(val)
                  if (val.length === 0) {
                    setDebouncedQuery('')
                    setShowDropdown(false)
                  } else {
                    setShowDropdown(true)
                  }
                  setSendSuccess(false)
                  setSendError('')
                }}
                onFocus={() => {
                  if (searchQuery.length >= 1) setShowDropdown(true)
                }}
                disabled={sendByUsernameMutation.isPending}
                className={styles.searchInput}
                aria-autocomplete="list"
                aria-controls={showDropdown && debouncedQuery.length >= 1 ? 'user-search-results' : undefined}
                aria-expanded={showDropdown && debouncedQuery.length >= 1}
              />
              {showDropdown && debouncedQuery.length >= 1 && (
                <ul
                  id="user-search-results"
                  role="listbox"
                  aria-label="Search results"
                  className={styles.searchDropdown}
                >
                  {isSearching ? (
                    <li className={styles.searchDropdownMsg} role="option" aria-selected={false}>
                      Searching...
                    </li>
                  ) : searchResults.length === 0 ? (
                    <li className={styles.searchDropdownMsg} role="option" aria-selected={false}>
                      No users found
                    </li>
                  ) : (
                    searchResults.map((user) => (
                      <li key={user.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          className={styles.searchResultBtn}
                          onClick={() => handleSelectUser(user)}
                          disabled={sendByUsernameMutation.isPending}
                        >
                          <span className={styles.searchResultName}>{user.username}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendByEmail} className={styles.sendForm} noValidate>
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
                disabled={sendByEmailMutation.isPending}
                className={styles.emailInput}
              />
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={sendByEmailMutation.isPending || !email.trim()}
              >
                {sendByEmailMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        )}

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
      </section>

      {requests.length > 0 && (
        <section className={styles.section} aria-labelledby="requests-heading">
          <h3 id="requests-heading" className={styles.sectionHeading}>
            Pending Requests
          </h3>
          <ul className={styles.list} aria-label="Pending friend requests">
            {requests.map((req) => (
              <li key={req.id} className={styles.listItem}>
                <span className={styles.displayName}>{req.username}</span>
                <div className={styles.actions}>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => acceptMutation.mutate(req.id)}
                    disabled={
                      acceptMutation.isPending &&
                      acceptMutation.variables === req.id
                    }
                    aria-label={`Accept friend request from ${req.username}`}
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
                    aria-label={`Decline friend request from ${req.username}`}
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
                <span className={styles.displayName}>{friend.username}</span>
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
                  aria-label={`Remove ${friend.username} from friends`}
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
