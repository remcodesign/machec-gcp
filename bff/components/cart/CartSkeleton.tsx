export function CartSkeleton() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      aria-label="Winkelmand laden"
    >
      <ul>
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className="flex animate-pulse gap-4 border-b border-stone-200 py-4"
          >
            <div className="h-20 w-20 shrink-0 bg-stone-100" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
              <div className="h-4 w-2/3 bg-stone-100" />
              <div className="h-3 w-1/3 bg-stone-100" />
              <div className="h-8 w-24 bg-stone-100" />
            </div>
          </li>
        ))}
      </ul>
      <div className="h-56 animate-pulse border border-stone-200 bg-stone-100" />
    </div>
  );
}
