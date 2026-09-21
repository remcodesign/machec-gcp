export function ProductCardSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-label="Producten laden"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse border border-stone-200 bg-white"
        >
          <div className="h-56 bg-stone-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-16 bg-stone-100" />
            <div className="h-5 w-4/5 bg-stone-100" />
            <div className="h-5 w-20 bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
