import { catalogCache } from "@/lib/catalogCache";

export async function GET(_request: Request, context: { params: Promise<{ sku: string }> }) {
    try {
        const { sku } = await context.params;
        const product = await catalogCache.getProduct(sku);

        if (!product) {
            return Response.json({ error: "Product not found." }, { status: 404 });
        }

        return Response.json(product);
    } catch {
        return Response.json({ error: "Catalog product is unavailable." }, { status: 502 });
    }
}