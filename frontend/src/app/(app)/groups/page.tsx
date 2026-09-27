import { Suspense } from "react";
import { GroupsPage } from "@/components/groups/groups-page";
import { LoadingState } from "@/components/ui/states";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <GroupsPage />
    </Suspense>
  );
}
