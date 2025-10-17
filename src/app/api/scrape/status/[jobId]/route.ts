import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { creatorDiscoveries, creators } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await context.params;

    // Get the specific discovery job
    const [job] = await db
      .select()
      .from(creatorDiscoveries)
      .where(eq(creatorDiscoveries.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get recently discovered creators from this job
    const recentCreators = await db
      .select()
      .from(creators)
      .orderBy(desc(creators.createdAt))
      .limit(10);

    return NextResponse.json({
      job: {
        id: job.id,
        source: job.source,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.createdAt,
        lastAttemptAt: job.lastAttemptAt,
        payload: job.payload,
      },
      recentCreators: recentCreators.slice(0, 5).map(c => ({
        username: c.username,
        followers: c.followerCount,
        videos: c.videoCount,
      })),
      progress: {
        total: (job.payload as any)?.limit || 20,
        completed: job.status === 'completed' ? (job.payload as any)?.limit || 20 : 0,
        status: job.status,
      },
    });
  } catch (error) {
    console.error('Error fetching scraping status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scraping status' },
      { status: 500 }
    );
  }
}
