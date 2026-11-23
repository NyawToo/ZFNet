# ZFNet Agro · frontend

Interfaz Next.js (App Router) para clasificar frutas con ZFNet y explicar la decisión con
DeconvNet. Tema oscuro «neural lab», animaciones CSS y sin dependencias extra de animación.

## Scripts

```powershell
npm run dev     # desarrollo en http://localhost:3000
npm run build   # build de producción
npm run start   # servir el build
```

El backend debe estar en `127.0.0.1:8000`; el navegador solo habla con `/api/backend`,
que actúa de proxy (`app/api/backend/[...path]/route.ts`).

## Estructura

```text
app/
  layout.tsx            shell: fondo neuronal, navbar, footer, metadatos e icono
  page.tsx              inicio: hero, pipeline interactivo, softmax, matemáticas
  explore/page.tsx      galería del dataset con predicción y mapas conv1–conv5
  predict/page.tsx      subida de imagen + top-10 + explorador DeconvNet
  train/page.tsx        laboratorio de entrenamiento con log en vivo
  globals.css           sistema de diseño (cards, botones, chips, sliders, grano)
  icon.svg              logo/favicon
  api/backend/          proxy hacia FastAPI
components/
  brand/                Logo, FruitIcon
  layout/               NavBar, Footer, NeuralBackground
  motion/               Reveal, CountUp
  inference/            Uploader, PredictionBars, LayerExplorer
  home/                 SoftmaxPlayground
lib/
  api.ts                cliente tipado del backend
  datasets.ts           inventario, páginas y muestras aleatorias
  fruit.ts              colores y nombres de frutas/clases
  image.ts              preparado de imágenes en el navegador
  types.ts              tipos compartidos con la API
```

## Convenciones

- Todos los componentes interactivos son `"use client"`.
- Los colores viven en `tailwind.config.ts`; los acentos por fruta en `lib/fruit.ts`.
- Las animaciones son keyframes de Tailwind (`float`, `rise`, `pop`, `shimmer`, `scan`, …) y
  respetan `prefers-reduced-motion` en los contadores.
- Las llamadas a la API pasan siempre por `lib/api.ts` o `lib/datasets.ts`.
