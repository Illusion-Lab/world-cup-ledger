import { ScheduleClientPage } from "@/components/schedule-client-page";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; synced?: string }>;
}) {
  const params = await searchParams;
  return <ScheduleClientPage initialError={params.error} initialSynced={params.synced} />;
}
