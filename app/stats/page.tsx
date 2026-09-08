import ModuleStatsScreen from "@/components/ModuleStatsScreen";

export default async function ModuleStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.module;
  const initialModule = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return <ModuleStatsScreen initialModule={initialModule} />;
}
