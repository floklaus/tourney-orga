import { UnsubscribeView } from "@/components/auth/unsubscribe-view";

export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  return <UnsubscribeView token={token} />;
}
