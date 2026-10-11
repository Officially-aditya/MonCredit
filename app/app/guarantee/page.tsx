import { redirect } from "next/navigation";

export default function GuaranteeRedirect() {
  redirect("/app/market?view=guarantees");
}
