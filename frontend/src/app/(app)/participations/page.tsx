import { Suspense } from "react";
import { ParticipationsPage } from "@/components/participations/participations-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ParticipationsPage />
    </Suspense>
  );
}
