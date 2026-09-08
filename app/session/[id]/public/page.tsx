import PublicResultsScreen from "@/components/PublicResultsScreen";

export default async function SessionPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicResultsScreen sessionId={id} />;
}
