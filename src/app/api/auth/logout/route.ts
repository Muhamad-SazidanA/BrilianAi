import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.delete('brilian_active_user_id');
  response.cookies.delete('brilian_user_status');

  // Also set expired cookies to force deletion across all browsers
  response.cookies.set({
    name: 'brilian_active_user_id',
    value: '',
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  response.cookies.set({
    name: 'brilian_user_status',
    value: '',
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });

  return response;
}
