export function CategoryListSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Categorieën laden">
            {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-28 animate-pulse border border-stone-200 bg-stone-100" />
            ))}
        </div>
    );
}