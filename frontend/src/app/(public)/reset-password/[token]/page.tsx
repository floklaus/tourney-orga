import { ResetConfirmForm } from "@/components/auth/reset-confirm-form";

export default async function ResetPasswordConfirmPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  return <ResetConfirmForm token={token} />;
}
