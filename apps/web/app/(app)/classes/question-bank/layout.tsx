import { requirePermission } from '@/lib/access';

export default async function QuestionBankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('questions.view');
  return <>{children}</>;
}
