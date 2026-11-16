import { redirect } from "next/navigation";
import { isAdminProfile, requireTeacher } from "@/lib/teacher";

// Where a signed-in adult lands. Admins confirm their school once (welcome), then
// land on the School home. A teacher who runs one club lands on it; otherwise "My clubs".
export default async function TeacherHome() {
  const { supabase, userId, profile } = await requireTeacher();
  if (isAdminProfile(profile)) redirect(profile.onboarded_at ? "/teacher/school" : "/teacher/welcome");

  const { data } = await supabase.from("classes").select("id").eq("teacher_id", userId).limit(2);
  if (data?.length === 1) redirect(`/teacher/class/${data[0].id}`);
  redirect("/teacher/clubs");
}
