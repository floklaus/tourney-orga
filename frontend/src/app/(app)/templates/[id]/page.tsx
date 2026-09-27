import { TemplateEditor } from "@/components/templates/template-editor";

export default async function Page({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  return <TemplateEditor templateId={id} />;
}
