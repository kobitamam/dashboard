// Shown the moment a tab is clicked, while the server prepares the page, so a click
// gets an immediate answer instead of the previous page staying frozen on screen.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="טוען" className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-lg bg-border/60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
