import { redirect } from "next/navigation";

export default function LendRedirect() {
  redirect("/app/market?view=lending");
}
