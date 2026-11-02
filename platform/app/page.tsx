import { redirect } from "next/navigation";

// app.candideai.com is what kids type: send them straight to the join screen.
export default function Home() {
  redirect("/join");
}
