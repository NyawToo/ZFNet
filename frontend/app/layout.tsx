import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import NeuralBackground from "@/components/layout/NeuralBackground";

export const metadata: Metadata = {
  title: "ZFNet Agro · red neuronal para frutas",
  description:
    "Clasificación de frutas buenas y dañadas con ZFNet fine-tuneado y reconstrucción DeconvNet para ver qué píxeles activan cada neurona.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  openGraph: {
    title: "ZFNet Agro · red neuronal para frutas",
    description: "Cinco frutas, dos estados y una red convolucional que explica sus decisiones.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050A08",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <NeuralBackground />
        <NavBar />
        <main className="relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
