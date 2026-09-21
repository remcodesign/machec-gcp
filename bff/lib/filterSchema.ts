// Which attribute keys are filterable per category, and which values each
// one currently offers, both live on live PIM data now — filterable_attributes
// on the category record, option values on getCatalogFacets() (D40 cache-aside
// extension) — not declared here, so nothing in this file drifts the moment
// PIM Core's admin adds a category/attribute or a product's brand/attribute
// values change. Only the Dutch label text stays static — there's no live
// source for UI copy.
export const filterLabels: Record<string, string> = {
  category: "Categorie",
  brand: "Merk",
  price_range: "Prijs",
  component_type: "Type component",
  amperage: "Amperage",
  insert_type: "Type inzetstuk",
  mounting: "Montage",
  cable_type: "Type kabel",
  cores_and_thickness: "Aders en dikte",
  material_type: "Type materiaal",
};
