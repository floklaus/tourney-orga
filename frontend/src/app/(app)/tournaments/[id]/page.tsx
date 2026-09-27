import { Suspense } from "react";
import { TournamentDetail } from "@/components/tournaments/tournament-detail";
import { LoadingState } from "@/components/ui/states";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <TournamentDetail id={id} />
    </Suspense>
  );
}
