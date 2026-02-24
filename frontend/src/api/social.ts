import { apiFetch, apiFetchParsed } from './client';
import {
  FriendsResponseSchema,
  FriendRequestsResponseSchema,
  FeedResponseSchema,
  LeaderboardResponseSchema,
  ReactResponseSchema,
  UserSearchResponseSchema,
  CommentsResponseSchema,
  CreateCommentResponseSchema,
} from './schemas';
export type {
  Friend,
  FriendRequest,
  FeedEventPayload,
  FeedEvent,
  FeedReaction,
  ReactResponse,
  LeaderboardRanking,
  LeaderboardExercise,
  LeaderboardResponse,
  UserSearchResult,
  UserSearchResponse,
  FeedEventComment,
  CommentsResponse,
  CreateCommentResponse,
} from './schemas';

export async function sendFriendRequest(email: string): Promise<void> {
  await apiFetch('/social/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function sendFriendRequestByUsername(username: string): Promise<void> {
  await apiFetch('/social/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function searchUsers(q: string): Promise<typeof UserSearchResponseSchema._output> {
  return apiFetchParsed(`/social/search?q=${encodeURIComponent(q)}`, UserSearchResponseSchema);
}

export async function getFriends(): Promise<typeof FriendsResponseSchema._output> {
  return apiFetchParsed('/social/friends', FriendsResponseSchema);
}

export async function getFriendRequests(): Promise<typeof FriendRequestsResponseSchema._output> {
  return apiFetchParsed('/social/requests', FriendRequestsResponseSchema);
}

export async function acceptFriendRequest(id: number): Promise<void> {
  await apiFetch(`/social/requests/${id}/accept`, { method: 'PATCH' });
}

export async function declineFriendRequest(id: number): Promise<void> {
  await apiFetch(`/social/requests/${id}/decline`, { method: 'PATCH' });
}

export async function removeFriend(id: number): Promise<void> {
  await apiFetch(`/social/friends/${id}`, { method: 'DELETE' });
}

export async function getFeed(): Promise<typeof FeedResponseSchema._output> {
  return apiFetchParsed('/social/feed', FeedResponseSchema);
}

export async function getLeaderboard(): Promise<typeof LeaderboardResponseSchema._output> {
  return apiFetchParsed('/social/leaderboard', LeaderboardResponseSchema);
}

export async function getE1rmLeaderboard(): Promise<typeof LeaderboardResponseSchema._output> {
  return apiFetchParsed('/social/leaderboard?mode=e1rm', LeaderboardResponseSchema);
}

export async function toggleReaction(eventId: number, emoji: string): Promise<typeof ReactResponseSchema._output> {
  return apiFetchParsed(`/social/feed/${eventId}/react`, ReactResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
}

export async function getComments(eventId: number): Promise<typeof CommentsResponseSchema._output> {
  return apiFetchParsed(`/social/feed/${eventId}/comments`, CommentsResponseSchema);
}

export async function createComment(eventId: number, text: string): Promise<typeof CreateCommentResponseSchema._output> {
  return apiFetchParsed(`/social/feed/${eventId}/comments`, CreateCommentResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function deleteComment(eventId: number, commentId: number): Promise<void> {
  await apiFetch(`/social/feed/${eventId}/comments/${commentId}`, { method: 'DELETE' });
}
