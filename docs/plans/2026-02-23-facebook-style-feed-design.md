# Facebook-Style Social Feed Redesign

## Goal

Redesign the social feed from a modal-based comment experience to inline comments and a Facebook-style action row. No new features — purely a UX restructure. No backend changes needed.

## Feed Item Layout

```
┌─────────────────────────────────┐
│ username               2h ago   │  Header
│                                 │
│ Event content (varies by type)  │  Body
│ Streak badge if applicable      │
│                                 │
│─────────────────────────────────│
│ 🔥👏💪 6            3 comments   │  Counts row (hidden if both zero)
│─────────────────────────────────│
│ [🔥 React]      [💬 Comment]    │  Action buttons
│─────────────────────────────────│
│ View all 5 comments             │  Shown when > 2 comments
│ jane · Nice squat PR!      [x] │  Last 2 comments visible
│ bob · Beast mode 💪         [x] │
│ [Write a comment...         ] ▶ │  Always-visible input
└─────────────────────────────────┘
```

## Counts Row

- **Left:** Unique emoji icons used + total count (e.g., "🔥👏💪 6"). Hidden if zero reactions.
- **Right:** Comment count (e.g., "3 comments"). Hidden if zero.
- Entire row hidden if both are zero.

## Reaction System

### Current
All 5 emojis shown as buttons with counts in a horizontal bar. Always visible.

### New
1. **React button** in action row. Shows your most recent emoji if you've reacted (e.g., "👏 React"), otherwise default "🔥 React".
2. **Popup emoji picker:** Tapping React opens a floating row of 5 emojis (🔥 👏 💀 💪 🤙) positioned above the button.
3. Tap an emoji to toggle reaction, picker closes.
4. Tap outside to dismiss without action.
5. Optimistic updates (same pattern as current).

## Inline Comments

### Default State
- Last 2 comments shown (chronological order, newest at bottom).
- "View all X comments" link above them when `commentCount > 2`.
- Single-line text input with send button always visible below comments.

### Expanded State
- Tapping "View all X comments" fetches full comment list via `GET /api/social/feed/:eventId/comments`.
- All comments render inline (no modal, no navigation).
- React Query caches fetched comments per event.

### Comment Input
- Always visible at bottom of each feed item.
- Single-line text field, max 500 chars.
- Send button on the right.
- Optimistic insert on submit: new comment appears at bottom immediately.
- Focus the input when "Comment" action button is tapped.

### Comment Deletion
- Delete button (x) visible on your own comments.
- Also visible on all comments if you own the feed event.
- Optimistic removal with rollback on error.

## Component Changes

| Component | Action |
|-----------|--------|
| `FeedTab.tsx` | Restructure to include counts row, action row, and inline comments per feed item |
| `ReactionBar.tsx` | **Delete.** Replace with `ActionRow`, `ReactionSummary`, and `EmojiPicker` components |
| `CommentSection.tsx` | Adapt for inline use: show last 2 by default, support "View all" expansion |
| `CommentModal.tsx` | **Delete.** No longer needed |
| New: `ActionRow.tsx` | React + Comment buttons |
| New: `ReactionSummary.tsx` | Emoji icons + total count display |
| New: `EmojiPicker.tsx` | Floating popup with 5 emoji options |

## API Changes

None. All existing endpoints support this redesign:
- `GET /api/social/feed` — already returns `commentCount` and `reactions[]`
- `GET /api/social/feed/:eventId/comments` — lazy-load full comment list
- `POST /api/social/feed/:eventId/comments` — create comment
- `DELETE /api/social/feed/:eventId/comments/:commentId` — delete comment
- `POST /api/social/feed/:eventId/react` — toggle reaction

## Data Flow

1. Feed loads with `commentCount` and `reactions[]` per event (existing).
2. Last 2 comments: fetched with main feed query OR lazy-loaded. Since the API currently returns `commentCount` but not the comments themselves, we need to either:
   - **Option A:** Add `latestComments` to the feed response (small backend change), or
   - **Option B:** Lazy-load comments for each visible feed item on mount.
   - **Recommended: Option A** — avoids N+1 fetches on feed load. Include last 2 comments in feed response.
3. "View all" fetches remaining comments via existing endpoint.

### Backend Tweak (Option A)

Include `latestComments: FeedEventComment[]` (last 2) in the feed event response. This is a small addition to the feed query — not a new endpoint, just enriching the existing response.

## Testing

- E2E tests: Update `e2e/feed-comments.spec.ts` and `e2e/feed-reactions.spec.ts` to work with new inline UI.
- No new backend tests needed (API unchanged, or minimal feed response enrichment).
