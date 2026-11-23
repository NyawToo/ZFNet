export type FruitKey = "bananas" | "mangos" | "manzanas" | "naranjas" | "papayas";

export type FruitMeta = {
  key: FruitKey;
  label: string;
  singular: string;
  color: string;
  soft: string;
};

export const FRUITS: FruitMeta[] = [
  { key: "bananas", label: "Bananas", singular: "banana", color: "#FFD84D", soft: "rgba(255,216,77,.18)" },
  { key: "mangos", label: "Mangos", singular: "mango", color: "#FFB020", soft: "rgba(255,176,32,.18)" },
  { key: "manzanas", label: "Manzanas", singular: "manzana", color: "#FF5C7A", soft: "rgba(255,92,122,.18)" },
  { key: "naranjas", label: "Naranjas", singular: "naranja", color: "#FF9F1C", soft: "rgba(255,159,28,.18)" },
  { key: "papayas", label: "Papayas", singular: "papaya", color: "#FF7A59", soft: "rgba(255,122,89,.18)" },
];

export const FRUIT_BY_KEY = FRUITS.reduce<Record<string, FruitMeta>>((acc, fruit) => {
  acc[fruit.key] = fruit;
  return acc;
}, {});

export function fruitOfLabel(label: string): FruitMeta | undefined {
  return FRUITS.find((fruit) => label.startsWith(fruit.singular));
}

export function isDamaged(label: string): boolean {
  return /da[nñ]ad[ao]/i.test(label);
}

export function classAccent(label: string) {
  const fruit = fruitOfLabel(label);
  const damaged = isDamaged(label);
  return {
    base: fruit?.color ?? "#A3E635",
    tip: damaged ? "#FF6B6B" : "#5EEAD4",
    damaged,
    fruit,
  };
}

export function prettyLabel(label: string): string {
  return label.replaceAll("_", " ");
}

export function prettyFruitState(label: string): string {
  return isDamaged(label) ? "dañada" : "buena";
}
