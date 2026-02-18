import { Button } from './Button'
import styles from './ExerciseFormModal.module.css'

interface Props {
  isEdit: boolean
  name: string
  slug: string
  muscleGroup: string
  category: string
  isUpperBody: boolean
  autoSlug: boolean
  submitting: boolean
  error: string
  onNameChange: (value: string) => void
  onSlugChange: (value: string) => void
  onMuscleGroupChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onIsUpperBodyChange: (value: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ExerciseForm({
  isEdit,
  name,
  slug,
  muscleGroup,
  category,
  isUpperBody,
  autoSlug,
  submitting,
  error,
  onNameChange,
  onSlugChange,
  onMuscleGroupChange,
  onCategoryChange,
  onIsUpperBodyChange,
  onSubmit,
  onClose,
}: Props) {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <h2>{isEdit ? 'Edit Exercise' : 'Add Exercise'}</h2>
        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Bench Press"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="slug">Slug *</label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="e.g., bench-press"
            required
          />
          <small className={styles.formHint}>
            {autoSlug ? 'Auto-generated from name' : 'Custom slug'}
          </small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="muscleGroup">Muscle Group</label>
          <input
            id="muscleGroup"
            type="text"
            value={muscleGroup}
            onChange={(e) => onMuscleGroupChange(e.target.value)}
            placeholder="e.g., Chest, Legs, Back"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="category">Category *</label>
          <select
            id="category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            required
          >
            <option value="compound">Compound</option>
            <option value="isolation">Isolation</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isUpperBody}
              onChange={(e) => onIsUpperBodyChange(e.target.checked)}
            />
            <span>Upper Body Exercise</span>
          </label>
        </div>

        {error && <div className={styles.formError}>{error}</div>}

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
