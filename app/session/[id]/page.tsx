import MatchingScreen from "@/components/MatchingScreen";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchingScreen sessionId={id} />;
}
