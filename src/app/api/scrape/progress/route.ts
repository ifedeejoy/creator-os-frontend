import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/db';
import { creatorDiscoveries, creators } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

// Server-Sent Events endpoint for real-time scraping progress
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Function to send updates
      const sendUpdate = async () => {
        try {
          // Get recent pending/processing jobs
          const pendingJobs = await db
            .select()
            .from(creatorDiscoveries)
            .where(eq(creatorDiscoveries.status, 'pending'))
            .orderBy(desc(creatorDiscoveries.createdAt))
            .limit(5);

          const processingJobs = await db
            .select()
            .from(creatorDiscoveries)
            .where(eq(creatorDiscoveries.status, 'processing'))
            .orderBy(desc(creatorDiscoveries.updatedAt))
            .limit(5);

          // Get recently completed creators
          const recentCreators = await db
            .select()
            .from(creators)
            .orderBy(desc(creators.createdAt))
            .limit(5);

          const data = {
            pendingJobs: pendingJobs.length,
            processingJobs: processingJobs.length,
            recentCreators: recentCreators.map(c => ({
              username: c.username,
              followers: c.followerCount,
            })),
            timestamp: new Date().toISOString(),
          };

          // Send the data as SSE
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Error in SSE stream:', error);
        }
      };

      // Send initial update
      await sendUpdate();

      // Send updates every 3 seconds
      const interval = setInterval(sendUpdate, 3000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
