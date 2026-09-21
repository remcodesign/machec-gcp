import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";
import { ProductDetail } from "@/components/catalog/ProductDetail";
import { getCatalogCategories, getCatalogProduct } from "@/hooks/useCatalog";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <Suspense fallback={<ProductCardSkeleton />}>
        <ProductContent sku={sku} />
      </Suspense>
    </main>
  );
}

async function ProductContent({ sku }: { sku: string }) {
  const [{ data: categories }, product] = await Promise.all([
    getCatalogCategories(),
    getCatalogProduct(sku),
  ]);

  if (!product) notFound();

  return (
    <ProductDetail
      category={categories.find(
        (category) => category.slug === product.category_slug,
      )}
      product={product}
    />
  );
}
