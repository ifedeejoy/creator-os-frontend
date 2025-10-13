import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { db } from '@/db';
import { videos, dailyMetrics, creators } from '@/db/schema';
import { eq, desc, sql, gte, and, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { schemaManifest } from '@/lib/schema-manifest';
import { prepareReadOnlyQuery } from '@/lib/sql-sanitizer';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Get authenticated user from session
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = session.userId;

  const result = streamText({
    model: google('gemini-2.0-flash-exp'),
    messages,
    system: `You are Lumo AI, an analytics assistant for TikTok creators.
Use the available tools to retrieve real data and never guess values.
You have read-only access to the following database schema:
${schemaManifest}`,
    tools: {
      getVideoMetrics: tool({
        description: 'Get video performance metrics for the authenticated user',
        parameters: z.object({
          limit: z.number().optional().default(10).describe('Number of videos to return'),
          sortBy: z.enum(['engagement', 'views', 'likes', 'recent']).optional().default('engagement').describe('Sort videos by this metric'),
        }),
        execute: async ({ limit, sortBy }) => {
          let orderBy;
          switch (sortBy) {
            case 'engagement':
              orderBy = desc(videos.engagementRate);
              break;
            case 'views':
              orderBy = desc(videos.viewCount);
              break;
            case 'likes':
              orderBy = desc(videos.likeCount);
              break;
            case 'recent':
              orderBy = desc(videos.videoCreatedAt);
              break;
          }

          const userVideos = await db
            .select()
            .from(videos)
            .where(eq(videos.userId, userId))
            .orderBy(orderBy)
            .limit(limit);

          return {
            videos: userVideos.map(v => ({
              id: v.tiktokVideoId,
              description: v.description?.slice(0, 100),
              views: v.viewCount,
              likes: v.likeCount,
              comments: v.commentCount,
              shares: v.shareCount,
              engagementRate: v.engagementRate,
              createdAt: v.videoCreatedAt,
            })),
            count: userVideos.length,
          };
        },
      }),

      getDailyMetrics: tool({
        description: 'Get daily performance metrics for a time period',
        parameters: z.object({
          days: z.number().optional().default(7).describe('Number of days to look back'),
        }),
        execute: async ({ days }) => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const metrics = await db
            .select()
            .from(dailyMetrics)
            .where(
              and(
                eq(dailyMetrics.userId, userId),
                gte(dailyMetrics.date, startDate.toISOString().split('T')[0])
              )
            )
            .orderBy(desc(dailyMetrics.date));

          const totals = metrics.reduce(
            (acc, m) => ({
              views: acc.views + (m.totalViews || 0),
              likes: acc.likes + (m.totalLikes || 0),
              comments: acc.comments + (m.totalComments || 0),
              shares: acc.shares + (m.totalShares || 0),
            }),
            { views: 0, likes: 0, comments: 0, shares: 0 }
          );

          return {
            period: `Last ${days} days`,
            totals,
            dailyBreakdown: metrics.map(m => ({
              date: m.date,
              views: m.totalViews,
              likes: m.totalLikes,
              engagement: m.avgEngagementRate,
              followers: m.followerCount,
            })),
          };
        },
      }),

      getOverallStats: tool({
        description: 'Get overall account statistics and summary',
        parameters: z.object({}),
        execute: async () => {
          const [videoStats] = await db
            .select({
              totalVideos: sql<number>`count(*)`,
              totalViews: sql<number>`sum(${videos.viewCount})`,
              totalLikes: sql<number>`sum(${videos.likeCount})`,
              avgEngagement: sql<number>`avg(${videos.engagementRate})`,
            })
            .from(videos)
            .where(eq(videos.userId, userId));

          const recentMetrics = await db
            .select()
            .from(dailyMetrics)
            .where(eq(dailyMetrics.userId, userId))
            .orderBy(desc(dailyMetrics.date))
            .limit(1);

          return {
            totalVideos: videoStats.totalVideos || 0,
            totalViews: videoStats.totalViews || 0,
            totalLikes: videoStats.totalLikes || 0,
            avgEngagementRate: parseFloat(videoStats.avgEngagement?.toFixed(2) || '0'),
            currentFollowers: recentMetrics[0]?.followerCount || 0,
          };
        },
      }),

      findSimilarCreators: tool({
        description: 'Find similar creators in the database based on follower count',
        parameters: z.object({
          minFollowers: z.number().optional().describe('Minimum follower count'),
          maxFollowers: z.number().optional().describe('Maximum follower count'),
          limit: z.number().optional().default(10).describe('Maximum number of results'),
        }),
        execute: async ({ minFollowers, maxFollowers, limit }) => {
          let query = db.select().from(creators);

          const conditions = [];
          if (minFollowers) {
            conditions.push(gte(creators.followerCount, minFollowers));
          }
          if (maxFollowers) {
            conditions.push(lte(creators.followerCount, maxFollowers));
          }

          if (conditions.length > 0) {
            query = query.where(and(...conditions)) as any;
          }

          const similarCreators = await query
            .orderBy(desc(creators.followerCount))
            .limit(limit);

          return {
            creators: similarCreators.map(c => ({
              username: c.username,
              followers: c.followerCount,
              totalLikes: c.totalLikes,
              videos: c.videoCount,
              bio: c.bio?.slice(0, 100),
            })),
            count: similarCreators.length,
          };
        },
      }),

      runCustomAnalyticsQuery: tool({
        description: 'Run a read-only SQL SELECT query against the analytics schema. Include {{user_id}} when referencing user-scoped tables (videos, daily_metrics).',
        parameters: z.object({
          query: z.string().min(10).describe('SQL SELECT statement using tables documented in the schema manifest'),
        }),
        execute: async ({ query }) => {
          const preparedQuery = prepareReadOnlyQuery(query, userId);
          const result = await db.execute(sql.raw(preparedQuery));
          const rows = 'rows' in result ? result.rows : result;
          return {
            query: preparedQuery,
            rowCount: Array.isArray(rows) ? rows.length : 0,
            rows,
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
