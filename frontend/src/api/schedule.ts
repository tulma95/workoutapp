import { apiFetch } from './client';
import { ScheduleEntrySchema, ScheduleResponseSchema } from './schemas';
export type { ScheduleEntry } from './schemas';

export async function getSchedule(): Promise<typeof ScheduleEntrySchema._output[]> {
  const data = await apiFetch('/schedule');
  const parsed = ScheduleResponseSchema.parse(data);
  return parsed.schedule;
}

export async function saveSchedule(
  schedule: typeof ScheduleEntrySchema._output[]
): Promise<typeof ScheduleEntrySchema._output[]> {
  const data = await apiFetch('/schedule', {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  });
  const parsed = ScheduleResponseSchema.parse(data);
  return parsed.schedule;
}
