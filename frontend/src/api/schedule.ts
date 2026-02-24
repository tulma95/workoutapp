import { apiFetchParsed } from './client';
import { ScheduleEntrySchema, ScheduleResponseSchema } from './schemas';
export type { ScheduleEntry } from './schemas';

export async function getSchedule(): Promise<typeof ScheduleEntrySchema._output[]> {
  const parsed = await apiFetchParsed('/schedule', ScheduleResponseSchema);
  return parsed.schedule;
}

export async function saveSchedule(
  schedule: typeof ScheduleEntrySchema._output[]
): Promise<typeof ScheduleEntrySchema._output[]> {
  const parsed = await apiFetchParsed('/schedule', ScheduleResponseSchema, {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  });
  return parsed.schedule;
}
