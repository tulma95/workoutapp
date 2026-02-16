# Remove LB Unit Support

## Summary

Remove all LB (pounds) unit support from the app. Only KG is used and there are no LB users. This is a full removal across database, backend, frontend, and tests.

## Database

- Drop `unit_preference` column from `users` table via Prisma migration
- The concept of unit preference no longer exists in the system

## Backend

- Remove `UnitPreference` type from `types/index.ts`
- Remove `unitPreference` from register schema in `routes/auth.ts`
- Remove `unitPreference` from update schema in `routes/users.ts`
- Simplify `lib/weightRounding.ts`: remove `unit` param, always round to nearest 2.5 kg
- Check and simplify workout service and training max service if they reference unit

## Frontend

- Simplify `utils/weight.ts`: `formatWeight(kg)` rounds to 2.5 and returns `"X kg"`. Remove `convertWeight`, `convertToKg`, `UnitPreference` param from all signatures.
- Remove `UnitPreference` type from `types.ts`
- Remove `unitPreference` from `AuthContext` user state
- Remove unit preference selector from register page
- Remove unit preference selector from settings page
- Remove `unitPreference` from Zod response schemas in `api/schemas.ts`
- Update all components calling `formatWeight` to drop the unit param

## Display

Weight display keeps the "kg" suffix (e.g. "100 kg").

## Tests

- Delete `e2e/unit-conversion.spec.ts`
- Update `backend/src/__tests__/lib/weightRounding.test.ts`: remove LB cases
- Update backend test helpers, auth tests, users tests to remove `unitPreference`
- Update E2E register/settings page objects and specs
