import type { FilterSchema } from "@/types/catalog";

export const filterSchema: FilterSchema = {
  global: ["category", "brand", "price_range"],
  category_conditional: {
    "groepenkast-componenten": ["component_type", "amperage"],
    schakelmateriaal: ["insert_type", "mounting"],
    "kabels-draden": ["cable_type", "cores_and_thickness"],
    installatiemateriaal: ["material_type"],
  },
};

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
