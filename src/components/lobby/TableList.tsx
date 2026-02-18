export function TableList() {
  return (
    <div className="flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900">
      <h3 className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-300">
        Open Tables
      </h3>
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-500">
          No tables yet. Create a table or use Quick Match.
        </p>
      </div>
    </div>
  );
}
