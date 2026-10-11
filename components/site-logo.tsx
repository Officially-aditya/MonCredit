import Link from "next/link";
import Image from "next/image";

export function SiteLogo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="MonCredit home">
      <Image className="brand-mark" src="/brand/moncredit-icon-full-color.svg" alt="" aria-hidden="true" width={28} height={28} />
      <span>moncredit</span>
    </Link>
  );
}
