import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { creatorDiscoveries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { hashtags, limit = 20 } = body;

    // Default hashtags if none provided
    const targetHashtags = hashtags && Array.isArray(hashtags) && hashtags.length > 0
      ? hashtags
      : ['tiktokshop', 'tiktokmademebuy', 'tiktokfinds'];

    const results = {
      success: true,
      message: 'Scraping jobs queued successfully',
      hashtags: targetHashtags,
      limit,
      note: 'The scraping process will run in the background. Check back later for results.',
    };

    // Queue discovery tasks for each hashtag
    const discoveryTasks = targetHashtags.map(async (hashtag: string) => {
      // Check if there's already a pending discovery for this hashtag
      const existing = await db
        .select()
        .from(creatorDiscoveries)
        .where(
          and(
            eq(creatorDiscoveries.source, `hashtag:${hashtag}`),
            eq(creatorDiscoveries.status, 'pending')
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // Create a new discovery task
        await db.insert(creatorDiscoveries).values({
          username: `discovery-${hashtag}-${Date.now()}`,
          source: `hashtag:${hashtag}`,
          status: 'pending',
          payload: {
            hashtag,
            limit,
            requestedAt: new Date().toISOString(),
          },
        });
      }
    });

    await Promise.all(discoveryTasks);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to queue scraping jobs' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get recent discovery tasks
    const recentDiscoveries = await db
      .select()
      .from(creatorDiscoveries)
      .orderBy(creatorDiscoveries.createdAt)
      .limit(50);

    const stats = {
      total: recentDiscoveries.length,
      pending: recentDiscoveries.filter(d => d.status === 'pending').length,
      completed: recentDiscoveries.filter(d => d.status === 'completed').length,
      failed: recentDiscoveries.filter(d => d.status === 'failed').length,
    };

    return NextResponse.json({
      stats,
      recentDiscoveries: recentDiscoveries.slice(0, 10),
    });
  } catch (error) {
    console.error('Error fetching scraping status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scraping status' },
      { status: 500 }
    );
  }
}
