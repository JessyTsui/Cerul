import Image from "next/image";
import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-brand)] bg-[linear-gradient(180deg,rgba(34,211,238,0.24),rgba(12,18,32,0.55))] shadow-[0_20px_50px_rgba(7,17,28,0.4)] transition-transform duration-200 group-hover:-translate-y-0.5">
        <Image
          src="/logo.svg"
          alt=""
          width={24}
          height={24}
          unoptimized
          className="h-6 w-6"
        />
      </span>
      <span className="text-xl font-bold tracking-tight text-white transition-colors duration-200 group-hover:text-[var(--brand-bright)]">
        Cerul
      </span>
    </Link>
  );
}
