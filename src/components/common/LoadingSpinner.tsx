export function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
    </div>
  );
}
