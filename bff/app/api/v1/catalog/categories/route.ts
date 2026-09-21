import { catalogCache } from "@/lib/catalogCache";

export async function GET() {
  try {
    return Response.json(await catalogCache.getCategories());
  } catch {
    return Response.json(
      { error: "Catalog categories are unavailable." },
      { status: 502 },
    );
  }
}
