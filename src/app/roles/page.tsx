import { redirect } from 'next/navigation';

export default function RolesRedirectPage() {
  redirect('/users?tab=roles');
}
