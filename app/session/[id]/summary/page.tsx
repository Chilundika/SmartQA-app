import SummaryScreen from "@/components/SummaryScreen";

export default async function SessionSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SummaryScreen sessionId={id} />;
}
