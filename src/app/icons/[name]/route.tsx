import { ImageResponse } from "next/og";

// Icônes de l'application générées à la compilation (pas de fichier binaire dans le dépôt).
// Une patte blanche sur le vert `primary`. La version « maskable » garde le motif dans la zone sûre
// (cercle central de 80 %) car le système peut rogner les bords.
const icons = {
  "icon-192.png": { size: 192, scale: 0.62 },
  "icon-512.png": { size: 512, scale: 0.62 },
  "maskable-512.png": { size: 512, scale: 0.46 },
} as const;

export function generateStaticParams() {
  return Object.keys(icons).map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = icons[(await params).name as keyof typeof icons];
  if (!icon) return new Response("Not found", { status: 404 });
  const paw = icon.size * icon.scale;
  const toe = paw * 0.22;
  const dot = (left: number, top: number, w: number, h: number) => (
    <div style={{ position: "absolute", left: paw * left, top: paw * top, width: paw * w, height: paw * h, borderRadius: "50%", background: "#fdfcf9" }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#5f6e55" }}>
        <div style={{ position: "relative", width: paw, height: paw, display: "flex" }}>
          {dot(0.04, 0.34, toe / paw, (toe * 1.25) / paw)}
          {dot(0.27, 0.12, toe / paw, (toe * 1.25) / paw)}
          {dot(0.51, 0.12, toe / paw, (toe * 1.25) / paw)}
          {dot(0.74, 0.34, toe / paw, (toe * 1.25) / paw)}
          {dot(0.2, 0.5, 0.6, 0.46)}
        </div>
      </div>
    ),
    { width: icon.size, height: icon.size },
  );
}
