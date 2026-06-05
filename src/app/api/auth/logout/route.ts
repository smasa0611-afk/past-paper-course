import { NextResponse } from 'next/server';
import { buildSessionCookieOptions } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('session', '', {
    ...buildSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
