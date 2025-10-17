import axios from 'axios';
import { encrypt, decrypt } from './encryption';
import { db } from '@/db';
import { users, videos } from '@/db/schema';
import { eq } from 'drizzle-orm';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const DEFAULT_REDIRECT_PATH = '/auth/tiktok/callback';

export function getTikTokRedirectUri() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_BASE_URL is not configured');
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const redirectPath = process.env.TIKTOK_REDIRECT_PATH || DEFAULT_REDIRECT_PATH;
  const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;

  return `${normalizedBase}${normalizedPath}`;
}

export class TikTokClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getUserInfo() {
    const response = await axios.get(`${TIKTOK_API_BASE}/user/info/`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      params: {
        fields:
          'open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count',
      },
    });

    return response.data.data.user;
  }

  async getUserVideos(totalDesired = 100) {
    const collected: any[] = [];
    let cursor: string | undefined = undefined;
    const fields = 'id,create_time,cover_image_url,share_url,video_description,duration,height,width,title,embed_html,embed_link,like_count,comment_count,share_count,view_count';

    // TikTok caps max_count at 20 per page; paginate until we reach totalDesired or run out
    try {
      while (collected.length < totalDesired) {
        const remaining = totalDesired - collected.length;
        const pageSize = Math.min(20, Math.max(1, remaining));

        const body: Record<string, any> = { max_count: pageSize, fields };
        if (cursor) body.cursor = cursor;

        const response = await axios.post(
          `${TIKTOK_API_BASE}/video/list/`,
          body,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const data = response?.data?.data;
        const videos = data?.videos ?? [];
        collected.push(...videos);

        if (!data?.has_more || !data?.cursor) {
          break;
        }
        cursor = data.cursor;
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const tiktokError = err?.response?.data ?? err?.message;
      throw new Error(`TikTok video.list failed (${status ?? 'no-status'}): ${JSON.stringify(tiktokError)}`);
    }

    return collected;
  }
}

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const response = await axios.post(
    'https://open.tiktokapis.com/v2/oauth/token/',
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getTikTokRedirectUri(),
      code_verifier: codeVerifier,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await axios.post(
    'https://open.tiktokapis.com/v2/oauth/token/',
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

export async function getValidTokenForUser(userId: string): Promise<string> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.accessTokenEncrypted) {
    throw new Error('User not authenticated');
  }

  // Check if token expired
  const now = new Date();
  const expiresAt = user.tokenExpiresAt;

  if (expiresAt && expiresAt < new Date(now.getTime() + 5 * 60 * 1000)) {
    // Token expires in <5 minutes, refresh it
    const refreshToken = decrypt(user.refreshTokenEncrypted!);
    const tokenData = await refreshAccessToken(refreshToken);

    // Update tokens in DB
    await db
      .update(users)
      .set({
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: encrypt(tokenData.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return tokenData.access_token;
  }

  return decrypt(user.accessTokenEncrypted);
}

export async function syncUserData(userId: string) {
  const accessToken = await getValidTokenForUser(userId);
  const client = new TikTokClient(accessToken);

  // Fetch user info
  const userInfo = await client.getUserInfo();

  // Update user record
  await db
    .update(users)
    .set({
      followerCount: userInfo.follower_count,
      followingCount: userInfo.following_count,
      totalLikes: userInfo.likes_count,
      avatarUrl: userInfo.avatar_url,
      bio: userInfo.bio_description,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Fetch and store videos
  const userVideos = await client.getUserVideos(100);

  for (const video of userVideos) {
    const totalInteractions = (video.like_count ?? 0) + (video.comment_count ?? 0) + (video.share_count ?? 0);
    const views = Math.max(0, video.view_count ?? 0);
    const engagementRate = views > 0 ? ((totalInteractions / views) * 100).toFixed(2) : '0.00';

    await db
      .insert(videos)
      .values({
        userId,
        tiktokVideoId: video.id,
        description: video.video_description || video.title,
        viewCount: video.view_count,
        likeCount: video.like_count,
        commentCount: video.comment_count,
        shareCount: video.share_count,
        engagementRate,
        videoCreatedAt: new Date(video.create_time * 1000),
      })
      .onConflictDoUpdate({
        target: videos.tiktokVideoId,
        set: {
          viewCount: video.view_count,
          likeCount: video.like_count,
          commentCount: video.comment_count,
          shareCount: video.share_count,
          engagementRate,
        },
      });
  }

  return { userInfo, videosCount: userVideos.length };
}
