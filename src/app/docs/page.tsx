import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDocsHome } from '@/lib/docs/source';

export default function DocsIndexPage() {
  const cookieStore = cookies();
  const language = cookieStore.get('app-language')?.value === 'en' ? 'en' : 'id';

  redirect(getDocsHome(language));
}

