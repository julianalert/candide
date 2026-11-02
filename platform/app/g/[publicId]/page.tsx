import Image from "next/image";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { appUrl } from "@/lib/env";
import { loadGalleryByPublicId } from "@/lib/gallery";

export const metadata = { title: "Class gallery", robots: { index: false } };

// Public mirror: reachable only by its unguessable link, no teacher chrome, first names only.
export default async function PublicGalleryPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[A-Z2-9]{12}$/.test(publicId)) notFound();
  const data = await loadGalleryByPublicId(publicId);
  if (!data) notFound();

  return (
    <div className="kid-shell">
      <header className="kid-topbar no-print">
        <Image className="wordmark" src="/logo.svg" alt="Candide" width={107} height={22} />
        <span className="meta">Class gallery</span>
      </header>
      <main className="page">
        <Gallery data={data} publicUrl={`${appUrl()}/g/${publicId}`} mode="public" />
      </main>
    </div>
  );
}
