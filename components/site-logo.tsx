import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SiteLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="MonCredit home">
      <span className="brand-mark"><Sparkles size={17} strokeWidth={2.4} /></span>
      <span>moncredit</span>
    </Link>
  );
}
