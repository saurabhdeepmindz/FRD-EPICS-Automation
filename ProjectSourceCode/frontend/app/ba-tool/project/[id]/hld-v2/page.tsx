import { redirect } from 'next/navigation';

/**
 * Phase F cutover (v10) — the enhanced HLD has been promoted to the canonical
 * `/hld` route. This legacy `/hld-v2` path now permanently redirects there so old
 * bookmarks/links keep working.
 */
export default function HldV2Redirect({ params }: { params: { id: string } }) {
  redirect(`/ba-tool/project/${params.id}/hld`);
}
