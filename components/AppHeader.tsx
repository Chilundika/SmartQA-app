import Image from "next/image";
import Link from "next/link";
import logo from "@/images/logo.jpeg";

export default function AppHeader() {
  return (
    <header className="app-chrome print:hidden border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-2 sm:px-6 sm:py-2.5">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 sm:gap-3" aria-label="SmartQA Sort home">
          <Image
            src={logo}
            alt="SmartQA Sort"
            width={80}
            height={83}
            sizes="(max-width: 640px) 40px, 80px"
            className="h-10 w-auto sm:h-20"
            priority
          />
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
              SmartQA Sort
            </span>
            <span className="block text-[11px] text-zinc-500 sm:text-xs">by SmartProtocol-ZM</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
