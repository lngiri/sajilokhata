export default function DashboardLoading() {
  return (
    <div className="pb-20">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
              <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-20 bg-white rounded-2xl p-4 shadow-sm border border-gray-50 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white rounded-xl shadow-sm border border-gray-50 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
