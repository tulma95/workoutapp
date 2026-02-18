import styles from '../../styles/PlanEditorPage.module.css';

interface PlanMetadataFormProps {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  description: string;
  daysPerWeek: number;
  isPublic: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onResetSlug: () => void;
  onDescriptionChange: (value: string) => void;
  onDaysPerWeekChange: (value: number) => void;
  onIsPublicChange: (value: boolean) => void;
}

export default function PlanMetadataForm({
  name,
  slug,
  slugManuallyEdited,
  description,
  daysPerWeek,
  isPublic,
  collapsed,
  onToggleCollapsed,
  onNameChange,
  onSlugChange,
  onResetSlug,
  onDescriptionChange,
  onDaysPerWeekChange,
  onIsPublicChange,
}: PlanMetadataFormProps) {
  return (
    <div
      className={`${styles.metadataSection} ${collapsed ? styles.metadataCollapsed : ''}`}
      data-testid="metadata-section"
      data-collapsed={collapsed || undefined}
    >
      <button
        className={styles.metadataToggle}
        onClick={onToggleCollapsed}
        data-testid="metadata-toggle"
      >
        <span className={styles.metadataToggleLabel}>
          {collapsed ? '▸' : '▾'} Plan Details
          {collapsed && name && (
            <span className={styles.metadataSummary}> — {name} ({daysPerWeek} days/week)</span>
          )}
        </span>
      </button>

      {!collapsed && (
        <>
          <div className={styles.formRow}>
            <label>
              Plan Name *
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g., nSuns 4-Day LP"
              />
            </label>
          </div>

          <div className={`${styles.formRow} ${styles.slugRow}`}>
            <label>
              Slug *
              <input
                type="text"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="e.g., nsuns-4day-lp"
              />
            </label>
            {slugManuallyEdited && (
              <button className={styles.resetSlugBtn} onClick={onResetSlug}>
                Auto-generate
              </button>
            )}
          </div>

          <div className={styles.formRow}>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Describe this workout plan..."
                rows={3}
              />
            </label>
          </div>

          <div className={styles.formRowInline}>
            <label>
              Days per Week *
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="7"
                value={daysPerWeek}
                onChange={(e) => onDaysPerWeekChange(parseInt(e.target.value, 10))}
              />
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => onIsPublicChange(e.target.checked)}
              />
              <span>Public (visible to users)</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
