import { useState, useEffect, useRef } from 'react';
import { Exercise, CreateExerciseInput, UpdateExerciseInput } from '../api/exercises';
import styles from './ExerciseFormModal.module.css';
import shared from '../styles/shared.module.css';

interface ExerciseFormModalProps {
  exercise?: Exercise | null;
  onClose: () => void;
  onSubmit: (input: CreateExerciseInput | UpdateExerciseInput) => Promise<void>;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ExerciseFormModal({ exercise, onClose, onSubmit }: ExerciseFormModalProps) {
  const isEdit = !!exercise;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState(exercise?.name || '');
  const [slug, setSlug] = useState(exercise?.slug || '');
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscleGroup || '');
  const [category, setCategory] = useState(exercise?.category || 'compound');
  const [isUpperBody, setIsUpperBody] = useState(exercise?.isUpperBody ?? true);
  const [autoSlug, setAutoSlug] = useState(!exercise);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  useEffect(() => {
    if (autoSlug && name) {
      setSlug(slugify(name));
    }
  }, [name, autoSlug]);

  const handleSlugChange = (value: string) => {
    setAutoSlug(false);
    setSlug(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        slug: slug.trim(),
        muscleGroup: muscleGroup.trim() || undefined,
        category,
        isUpperBody,
      };

      await onSubmit(input);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleDialogClick}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2>{isEdit ? 'Edit Exercise' : 'Add Exercise'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => handleSlugChange(e.target.value)}
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
              onChange={(e) => setMuscleGroup(e.target.value)}
              placeholder="e.g., Chest, Legs, Back"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
                onChange={(e) => setIsUpperBody(e.target.checked)}
              />
              <span>Upper Body Exercise</span>
            </label>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={shared.btnSecondary} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={shared.btnPrimary} disabled={submitting}>
              {submitting ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
