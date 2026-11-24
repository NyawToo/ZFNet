import Image from "next/image";

/**
 * Institutional logo of Universidad de Cundinamarca.
 *
 * The asset is white-on-transparent so it stays legible on the dark theme.
 * It is used as a discreet, persistent accreditation mark across the app.
 */
export default function UniversityLogo({ className = "h-8" }: { className?: string }) {
  return (
    <Image
      src="/ucundinamarca-logo-white.png"
      alt="Universidad de Cundinamarca"
      width={1478}
      height={574}
      className={`w-auto ${className}`}
      sizes="180px"
    />
  );
}
