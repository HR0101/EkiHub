/** The document design selects both the shape and motion without a hydration delay. */
export function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="loading-indicator__motion" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}
