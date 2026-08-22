/* Route loading fallback. Shape read off the rendered page: no table at all —
   a class picker, then a lessons list beside a lesson EDITOR. It had been
   painting a ten-row data table, which is not what arrives.
   (AGENTS.md golden rule 11.) */
import { ListDetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return (
    <ListDetailPageSkeleton
      actions={0}
      filters={1}
      listRows={6}
      detail="form"
    />
  );
}
