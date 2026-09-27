import { ParticipationPage } from "@/components/participations/participation-page";

export default async function Page({ params }: PageProps<"/participations/[id]">) {
  const { id } = await params;
  return <ParticipationPage id={id} />;
}
