// Which attribute keys are filterable per category lives on the category
// itself (Category.filterable_attributes, from PIM Core's own category
// record via getCatalogCategories()'s D40 cache-aside) — not declared here,
// so nothing in this file drifts the moment PIM Core's admin adds a new one.
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

export const catalogBrands = [
  "ABB",
  "Attema",
  "Busch-Jaeger",
  "Donné",
  "EMAT",
  "Gira",
  "Nexans",
  "Pipelife",
  "Wago",
];
