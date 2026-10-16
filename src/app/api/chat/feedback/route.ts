import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { saveAnswerFeedback, logKnowledgeGap } from '@lib/db/knowledgeGapStore';
import { saveAuditLog } from '@lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    const body = await request.json();
    const { sessionId, queryText, answerText, rating, feedbackText } = body;

    if (!queryText || !answerText || !rating) {
      return NextResponse.json(
        { error: 'Fields "queryText", "answerText", and "rating" are required.' },
        { status: 400 }
      );
    }

    if (!['helpful', 'incorrect', 'outdated'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be "helpful", "incorrect", or "outdated".' },
        { status: 400 }
      );
    }

    await saveAnswerFeedback({
      sessionId,
      userId: authenticatedUser?.id,
      queryText,
      answerText,
      rating,
      feedbackText,
    });

    // If negative feedback, flag query to knowledge_gaps for SME / Admin attention
    if (rating === 'incorrect' || rating === 'outdated') {
      await logKnowledgeGap(queryText, {
        userId: authenticatedUser?.id,
        divisionId: authenticatedUser?.department || 'General',
      });
    }

    if (authenticatedUser) {
      await saveAuditLog({
        sessionId: sessionId || 'adhoc',
        userId: authenticatedUser.id,
        userName: authenticatedUser.name,
        userEmail: authenticatedUser.email,
        userDepartment: authenticatedUser.department,
        queryText: `[Feedback: ${rating}] ${queryText}`,
        answerText: feedbackText || answerText,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, rating });
  } catch (error: any) {
    console.error('Error recording chat feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
