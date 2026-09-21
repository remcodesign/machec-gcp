import Image from "next/image";

interface GhostImageProps {
  alt?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}

const sizes = {
  sm: { className: "h-20 w-20", pixels: 80 },
  md: { className: "h-56 w-full", pixels: 224 },
  lg: { className: "h-96 w-full", pixels: 384 },
};

export function GhostImage({
  alt = "Productafbeelding",
  size = "md",
  priority = false,
}: GhostImageProps) {
  const imageSize = sizes[size];

  return (
    <div
      className={`relative overflow-hidden bg-stone-100 ${imageSize.className}`}
    >
      <Image
        src="/images/product-placeholder.svg"
        alt={alt}
        fill
        sizes={`${imageSize.pixels}px`}
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
