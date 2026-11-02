import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import {
  getSuggestedQuestionsForUser,
  DEFAULT_SYSTEM_SUGGESTIONS,
} from '@lib/ai/suggestionService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const suggestions = await getSuggestedQuestionsForUser(user);

    return NextResponse.json(
      {
        suggestions: suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SYSTEM_SUGGESTIONS,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('[API /api/chat/suggestions] Error:', error);
    return NextResponse.json(
      { suggestions: DEFAULT_SYSTEM_SUGGESTIONS },
      { status: 200 }
    );
  }
}
