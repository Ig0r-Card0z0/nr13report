export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
      <div className="animate-spin rounded-full border-2 border-gray-200 border-t-primary-700 w-6 h-6" />
      <span className="text-sm">Carregando...</span>
    </div>
  );
}
