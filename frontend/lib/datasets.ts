import type { DatasetInventory, DatasetItem, DatasetPage } from "./types";

/** Dataset publicado junto al checkpoint. */
export const DATASET = "fruits_dataset_synthetic";

/** Imágenes por página en la galería. */
export const PAGE_SIZE = 24;

const BASE = "/api/backend";

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    let detail = `error ${res.status}`;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** Inventario de frutas y clases con sus conteos. */
export function fetchInventory(dataset = DATASET): Promise<DatasetInventory> {
  return json<DatasetInventory>(`/datasets?dataset=${encodeURIComponent(dataset)}`);
}

/** Página de imágenes de una clase concreta. */
export function fetchDatasetPage(
  fruit: string,
  label: string,
  page = 1,
  pageSize = PAGE_SIZE,
  dataset = DATASET,
): Promise<DatasetPage> {
  const params = new URLSearchParams({
    fruit,
    label,
    page: String(page),
    page_size: String(pageSize),
  });
  return json<DatasetPage>(`/dataset-page/${encodeURIComponent(dataset)}?${params.toString()}`);
}

/** URL de una imagen del dataset servida por el backend. */
export function datasetImageUrl(fruit: string, label: string, filename: string, dataset = DATASET): string {
  return `${BASE}/dataset-image/${encodeURIComponent(dataset)}/${encodeURIComponent(fruit)}/${encodeURIComponent(
    label,
  )}/${encodeURIComponent(filename)}`;
}

export function randomOf<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export type RandomSample = {
  fruit: string;
  label: string;
  item: DatasetItem;
  url: string;
  blob: Blob;
};

/** Elige una imagen al azar del dataset y la descarga como Blob. */
export async function randomSample(dataset = DATASET): Promise<RandomSample | null> {
  const inventory = await fetchInventory(dataset);
  const fruit = randomOf(Object.keys(inventory.fruits));
  if (!fruit) return null;
  const label = randomOf(Object.keys(inventory.fruits[fruit]));
  if (!label) return null;

  const page = await fetchDatasetPage(fruit, label, 1, PAGE_SIZE, dataset);
  const item = randomOf(page.items);
  if (!item) return null;

  const url = datasetImageUrl(fruit, label, item.filename, dataset);
  const blob = await (await fetch(url)).blob();
  return { fruit, label, item, url, blob };
}
