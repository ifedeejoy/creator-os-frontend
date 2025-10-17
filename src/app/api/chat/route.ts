import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { db } from '@/db';
import { videos, dailyMetrics, creators, creatorDiscoveries } from '@/db/schema';
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
    model: google('gemini-flash-latest'),
    messages,
    system: `You are Lumo AI, an analytics assistant for TikTok creators.
Use the available tools to retrieve real data and never guess values.
You can also help users discover new creators by triggering scraping jobs.

When users ask about scraping, discovering creators, or want fresh data from TikTok hashtags,
use the triggerScraping tool to queue background jobs.

IMPORTANT: After calling tools and getting results, always provide a conversational summary
of the data in a friendly, helpful way. Format numbers nicely and give insights.

You have read-only access to the following database schema:
${schemaManifest}`,
    maxSteps: 5, // Allow multiple tool calls and final response
    onStepFinish: ({ text, toolCalls, toolResults }) => {
      console.log('🤖 Step finished:', {
        hasText: !!text,
        textLength: text?.length || 0,
        toolCallsCount: toolCalls?.length || 0,
        toolResultsCount: toolResults?.length || 0,
      });
      if (text) {
        console.log('📝 AI Text Response:', text.substring(0, 200));
      }
      if (toolCalls && toolCalls.length > 0) {
        console.log('🔧 Tool Calls:', toolCalls.map(tc => tc.toolName));
      }
    },
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

      triggerScraping: tool({
        description: 'Trigger TikTok scraping jobs to discover new creators from hashtags. This runs asynchronously in the background.',
        parameters: z.object({
          hashtags: z.array(z.string()).optional().describe('Hashtags to scrape (e.g., ["tiktokshop", "tiktokmademebuy"]). Defaults to popular shopping hashtags.'),
          limit: z.number().optional().default(20).describe('Number of creators to discover per hashtag'),
        }),
        execute: async ({ hashtags, limit }) => {
          const targetHashtags = hashtags && hashtags.length > 0
            ? hashtags
            : ['tiktokshop', 'tiktokmademebuy', 'tiktokfinds'];

          // Queue discovery tasks
          const tasks = targetHashtags.map(async (hashtag) => {
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

          await Promise.all(tasks);

          return {
            success: true,
            message: `Queued scraping jobs for ${targetHashtags.length} hashtags: ${targetHashtags.join(', ')}`,
            hashtags: targetHashtags,
            limit,
            note: 'The scraping will run in the background. Results will appear in the creators database once processing completes.',
          };
        },
      }),

      getScrapingStatus: tool({
        description: 'Check the status of recent scraping jobs and discovered creators',
        parameters: z.object({}),
        execute: async () => {
          const recentDiscoveries = await db
            .select()
            .from(creatorDiscoveries)
            .orderBy(desc(creatorDiscoveries.createdAt))
            .limit(20);

          const stats = {
            total: recentDiscoveries.length,
            pending: recentDiscoveries.filter(d => d.status === 'pending').length,
            completed: recentDiscoveries.filter(d => d.status === 'completed').length,
            failed: recentDiscoveries.filter(d => d.status === 'failed').length,
          };

          const recentCreators = await db
            .select()
            .from(creators)
            .orderBy(desc(creators.lastScrapedAt))
            .limit(10);

          return {
            scrapingStats: stats,
            recentDiscoveries: recentDiscoveries.slice(0, 5).map(d => ({
              source: d.source,
              status: d.status,
              createdAt: d.createdAt,
            })),
            recentlyDiscoveredCreators: recentCreators.map(c => ({
              username: c.username,
              followers: c.followerCount,
              videos: c.videoCount,
              lastScraped: c.lastScrapedAt,
            })),
          };
        },
      }),

      lookupDatabaseSchema: tool({
        description: 'Get information about the database schema, table structures, and available columns for writing queries',
        parameters: z.object({
          tableName: z.string().optional().describe('Specific table to get details for (optional)'),
        }),
        execute: async ({ tableName }) => {
          const schemaInfo = {
            tables: {
              users: {
                description: 'Authenticated TikTok users',
                columns: ['id', 'tiktokId', 'username', 'displayName', 'avatarUrl', 'followerCount', 'followingCount', 'totalLikes', 'bio', 'createdAt', 'updatedAt'],
                primaryKey: 'id',
                indexes: ['username'],
              },
              videos: {
                description: 'User video performance metrics',
                columns: ['id', 'userId', 'tiktokVideoId', 'description', 'viewCount', 'likeCount', 'commentCount', 'shareCount', 'engagementRate', 'videoCreatedAt', 'createdAt', 'updatedAt'],
                primaryKey: 'id',
                foreignKeys: { userId: 'users.id' },
                indexes: ['userId', 'engagementRate'],
                userScoped: true,
              },
              daily_metrics: {
                description: 'Daily aggregated metrics per user',
                columns: ['id', 'userId', 'date', 'totalViews', 'totalLikes', 'totalComments', 'totalShares', 'followerCount', 'avgEngagementRate', 'createdAt', 'updatedAt'],
                primaryKey: 'id',
                foreignKeys: { userId: 'users.id' },
                indexes: ['userId', 'date'],
                userScoped: true,
              },
              creators: {
                description: 'Discovered TikTok creators from scraping',
                columns: ['id', 'tiktokId', 'username', 'followerCount', 'followingCount', 'totalLikes', 'videoCount', 'bio', 'profileData', 'lastScrapedAt', 'createdAt', 'updatedAt'],
                primaryKey: 'id',
                indexes: ['username', 'followerCount'],
              },
              creator_discoveries: {
                description: 'Queue for creator discovery jobs',
                columns: ['id', 'username', 'source', 'status', 'payload', 'attempts', 'lastAttemptAt', 'createdAt', 'updatedAt'],
                primaryKey: 'id',
                indexes: ['username', 'status'],
              },
            },
          };

          if (tableName) {
            return {
              table: tableName,
              details: schemaInfo.tables[tableName as keyof typeof schemaInfo.tables] || 'Table not found',
            };
          }

          return schemaInfo;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
