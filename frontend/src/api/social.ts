import { apiFetch } from './client';
import {
  FriendsResponseSchema,
  FriendRequestsResponseSchema,
  FeedResponseSchema,
  LeaderboardResponseSchema,
} from './schemas';
export type {
  Friend,
  FriendRequest,
  FeedEventPayload,
  FeedEvent,
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
