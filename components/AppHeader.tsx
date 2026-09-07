import Image from "next/image";
import Link from "next/link";
import logo from "@/images/logo.jpeg";

export default function AppHeader() {
  return (
    <header className="print:hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-2.5">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="SmartQA Sort home">
          <Image
            src={logo}
            alt="SmartQA Sort"
            width={80}
            height={83}
            sizes="80px"
            className="h-20 w-auto"
            priority
          />
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              SmartQA Sort
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">by SmartProtocol-ZM</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
