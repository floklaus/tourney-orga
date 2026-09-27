import { Suspense } from "react";
import { TeamsPage } from "@/components/teams/teams-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeamsPage />
    </Suspense>
  );
}
