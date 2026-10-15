import { redirect } from 'next/navigation';

export default function KnowledgeGapsRedirectPage() {
  redirect('/logs?tab=gaps');
}
