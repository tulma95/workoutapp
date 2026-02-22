CREATE UNIQUE INDEX feed_events_streak_milestone_unique ON feed_events (user_id, (payload->>'days'::text)) WHERE event_type = 'streak_milestone';
