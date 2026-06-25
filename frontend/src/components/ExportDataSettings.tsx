import { useState } from 'react'
import { exportData } from '../api/user'
import { useToast } from './Toast'
import { extractErrorMessage } from '../api/errors'
import styles from '../styles/ExportDataSettings.module.css'

// GDPR data portability: download everything the user owns as a JSON file.
export function ExportDataSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function onExport() {
    setLoading(true)
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `setforge-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Data exported')
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to export data'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.label}>Your data</h3>
      <p className={styles.text}>
        Download all your workouts, training maxes, and progress as a JSON file.
      </p>
      <button className={styles.button} onClick={onExport} disabled={loading}>
        {loading ? 'Exporting…' : 'Export my data'}
      </button>
    </section>
  )
}
