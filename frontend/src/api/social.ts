import { apiFetch } from './client';
import {
  FriendsResponseSchema,
  FriendRequestsResponseSchema,
  FeedResponseSchema,
  LeaderboardResponseSchema,
  ReactResponseSchema,
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
} from './schemas';

export async function sendFriendRequest(email: string): Promise<void> {
  await apiFetch('/social/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getFriends(): Promise<typeof FriendsResponseSchema._output> {
  const data = await apiFetch('/social/friends');
  return FriendsResponseSchema.parse(data);
}

export async function getFriendRequests(): Promise<typeof FriendRequestsResponseSchema._output> {
  const data = await apiFetch('/social/requests');
  return FriendRequestsResponseSchema.parse(data);
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
  const data = await apiFetch('/social/feed');
  return FeedResponseSchema.parse(data);
}

export async function getLeaderboard(): Promise<typeof LeaderboardResponseSchema._output> {
  const data = await apiFetch('/social/leaderboard');
  return LeaderboardResponseSchema.parse(data);
}

export async function getE1rmLeaderboard(): Promise<typeof LeaderboardResponseSchema._output> {
  const data = await apiFetch('/social/leaderboard?mode=e1rm');
  return LeaderboardResponseSchema.parse(data);
}

export async function toggleReaction(eventId: number, emoji: string): Promise<typeof ReactResponseSchema._output> {
  const data = await apiFetch(`/social/feed/${eventId}/react`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
  return ReactResponseSchema.parse(data);
}
