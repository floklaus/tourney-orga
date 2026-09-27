import { Suspense } from "react";
import { TournamentsPage } from "@/components/tournaments/tournaments-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TournamentsPage />
    </Suspense>
  );
}
