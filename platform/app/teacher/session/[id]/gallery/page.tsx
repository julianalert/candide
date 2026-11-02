import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { appUrl } from "@/lib/env";
import { loadGalleryBySessionId } from "@/lib/gallery";
import { requireTeacher } from "@/lib/teacher";

export const metadata = { title: "Gallery" };

export default async function TeacherGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();
  // RLS decides whether this teacher may see the session; the service client then loads and signs.
  const { data: visible } = await supabase.from("sessions").select("id, class_id").eq("id", id).maybeSingle();
  if (!visible) notFound();
  const data = await loadGalleryBySessionId(id);
  if (!data) notFound();

  return (
    <main className="page">
      <p className="section-label no-print">
        <Link href={`/teacher/class/${visible.class_id}`}>{data.className}</Link> · <Link href={`/teacher/session/${id}`}>Launch page</Link>
      </p>
      <Gallery data={data} publicUrl={`${appUrl()}/g/${data.session.publicId}`} mode="teacher" />
    </main>
  );
}
