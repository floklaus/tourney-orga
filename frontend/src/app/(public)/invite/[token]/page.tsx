import { AcceptInvitation } from "@/components/auth/accept-invitation";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  return <AcceptInvitation token={token} />;
}
