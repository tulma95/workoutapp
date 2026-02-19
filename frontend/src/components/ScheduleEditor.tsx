import { useState, useEffect } from 'react'
import { Button } from './Button'
import type { ScheduleEntry } from '../api/schedule'
import styles from './ScheduleEditor.module.css'

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

type Props = {
  planDays: { dayNumber: number; name: string | null }[]
  schedule: ScheduleEntry[]
  onSave: (schedule: ScheduleEntry[]) => Promise<void>
  isSaving: boolean
  saveError?: string
}

function buildMap(schedule: ScheduleEntry[]): Record<number, number | null> {
  const map: Record<number, number | null> = {}
  for (const entry of schedule) {
    map[entry.dayNumber] = entry.weekday
  }
  return map
}

export function ScheduleEditor({ planDays, schedule, onSave, isSaving, saveError }: Props) {
  const [localMap, setLocalMap] = useState<Record<number, number | null>>(() =>
    buildMap(schedule),
  )

  useEffect(() => {
    setLocalMap(buildMap(schedule))
  }, [schedule])

  const scheduledWeekdays = Object.values(localMap).filter(
    (v): v is number => v !== null && v !== undefined,
  )
  const hasDuplicate = scheduledWeekdays.length !== new Set(scheduledWeekdays).size

  async function handleSave() {
    const entries: ScheduleEntry[] = planDays
      .filter((d) => localMap[d.dayNumber] != null)
      .map((d) => ({ dayNumber: d.dayNumber, weekday: localMap[d.dayNumber] as number }))
    await onSave(entries)
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Training Schedule</h3>
      <p className={styles.description}>
        Assign each training day to a weekday to see upcoming sessions on your calendar.
      </p>

      <div className={styles.rows}>
        {planDays.map((day) => (
          <div key={day.dayNumber} className={styles.row}>
            <span className={styles.dayName}>{day.name ?? `Day ${day.dayNumber}`}</span>
            <select
              aria-label={day.name ?? `Day ${day.dayNumber}`}
              className={styles.select}
              value={localMap[day.dayNumber] ?? ''}
              onChange={(e) => {
                const val = e.target.value
                setLocalMap((prev) => ({
                  ...prev,
                  [day.dayNumber]: val === '' ? null : parseInt(val, 10),
                }))
              }}
            >
              <option value="">Not scheduled</option>
              {WEEKDAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {hasDuplicate && (
        <p className={styles.warning} role="alert">
          Two or more days share the same weekday.
        </p>
      )}

      {saveError && (
        <p className={styles.warning} role="alert">
          {saveError}
        </p>
      )}

      <Button onClick={handleSave} disabled={isSaving} className={styles.saveBtn}>
        {isSaving ? 'Saving...' : 'Save Schedule'}
      </Button>
    </section>
  )
}
