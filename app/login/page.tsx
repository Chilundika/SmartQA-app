import { Suspense } from "react";
import AdminLoginScreen from "@/components/AdminLoginScreen";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-zinc-500">Loading…</p>}>
      <AdminLoginScreen />
    </Suspense>
  );
}
