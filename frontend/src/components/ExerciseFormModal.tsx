import { useState, useEffect, useRef } from 'react';
import { Exercise, CreateExerciseInput, UpdateExerciseInput } from '../api/exercises';
import { ExerciseForm } from './ExerciseForm';
import styles from './ExerciseFormModal.module.css';

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
      <ExerciseForm
        isEdit={isEdit}
        name={name}
        slug={slug}
        muscleGroup={muscleGroup}
        category={category}
        isUpperBody={isUpperBody}
        autoSlug={autoSlug}
        submitting={submitting}
        error={error}
        onNameChange={setName}
        onSlugChange={handleSlugChange}
        onMuscleGroupChange={setMuscleGroup}
        onCategoryChange={setCategory}
        onIsUpperBodyChange={setIsUpperBody}
        onSubmit={handleSubmit}
        onClose={onClose}
      />
    </dialog>
  );
}
