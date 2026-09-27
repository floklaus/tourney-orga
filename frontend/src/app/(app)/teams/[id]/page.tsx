import { Suspense } from "react";
import { TeamPage } from "@/components/teams/team-page";
import { LoadingState } from "@/components/ui/states";

export default async function Page({ params }: PageProps<"/teams/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <TeamPage id={id} />
    </Suspense>
  );
}
