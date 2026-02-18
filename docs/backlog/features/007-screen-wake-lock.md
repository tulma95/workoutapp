# Feature: Screen Wake Lock

**Priority**: High
**Effort**: Very Low (1-2 hours)
**Impact**: Essential gym UX - prevents screen timeout during workouts

## Problem

During workouts, the phone screen dims and locks between sets (typically 30s-2min auto-lock). Users must repeatedly unlock their phone to check the next set. This is annoying with sweaty/chalky hands and breaks workout flow.

## Solution

Use the Screen Wake Lock API to keep the screen on while a workout is active. Automatically release when the workout is completed or the user leaves the workout page.

## Technical Design

### `useWakeLock` Hook

```typescript
import { useEffect, useRef, useState } from 'react';

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);

  const request = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => setIsActive(false));
      setIsActive(true);
    } catch { /* user denied or not supported */ }
  };

  const release = async () => {
    await wakeLockRef.current?.release();
    wakeLockRef.current = null;
    setIsActive(false);
  };

  // Re-acquire when page becomes visible again (iOS releases on background)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isActive) {
        request();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isActive]);

  return { isActive, request, release };
}
```

### Usage in WorkoutPage

```typescript
const { request, release } = useWakeLock();

useEffect(() => {
  request();
  return () => { release(); };
}, []);
```

### Browser Support

- Chrome 84+, Edge 84+, Safari 16.4+ (iOS)
- Graceful no-op on unsupported browsers
- No polyfill needed

### No UI Required

This is invisible to the user. The screen simply stays on during workouts. No toggle needed - users expect this behavior from workout apps.

## Testing

- Manual: Start workout, verify screen doesn't dim after 1+ minutes
- E2E: Not easily testable (hardware API), skip automated tests
