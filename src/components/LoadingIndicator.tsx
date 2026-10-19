/** Theme colors and motion are supplied by the shared theme stylesheet. */
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
