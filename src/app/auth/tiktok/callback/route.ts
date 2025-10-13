import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TikTokClient, exchangeCodeForToken, syncUserData } from '@/lib/tiktok';
import { encrypt } from '@/lib/encryption';
import { createSession } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${error}`, process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/?error=missing_params', process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  // Verify CSRF state and get code_verifier
  const cookieStore = await cookies();
  const savedState = cookieStore.get('tiktok_oauth_state');
  const codeVerifier = cookieStore.get('tiktok_code_verifier');

  if (!savedState || savedState.value !== state) {
    return NextResponse.redirect(
      new URL('/?error=invalid_state', process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL('/?error=missing_code_verifier', process.env.NEXT_PUBLIC_BASE_URL)
    );
  }

  try {
    // Exchange code for tokens (with PKCE)
    const tokenData = await exchangeCodeForToken(code, codeVerifier.value);

    if (!tokenData?.access_token) {
      throw new Error('TikTok token exchange did not return an access token');
    }
    if (!tokenData?.refresh_token) {
      throw new Error('TikTok token exchange did not return a refresh token');
    }
    const expiresInSeconds = Number(tokenData.expires_in);
    if (!Number.isFinite(expiresInSeconds)) {
      throw new Error('TikTok token exchange did not include expires_in');
    }
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);
    const tokenExpiryDate = new Date(Date.now() + expiresInSeconds * 1000);

    const tiktokClient = new TikTokClient(tokenData.access_token);
    const userInfo = await tiktokClient.getUserInfo();

    const tiktokId = userInfo?.open_id || tokenData.open_id || userInfo?.union_id;

    if (!tiktokId) {
      throw new Error('TikTok user info did not include an open_id');
    }

    const displayName = userInfo?.display_name || userInfo?.username || tiktokId;
    const avatarUrl = userInfo?.avatar_url || null;
    const bio = userInfo?.bio_description || null;
    const followerCount = userInfo?.follower_count ?? null;
    const followingCount = userInfo?.following_count ?? null;
    const totalLikes = userInfo?.likes_count ?? null;

    // Store or update user
    const [user] = await db
      .insert(users)
      .values({
        tiktokId,
        username: displayName,
        displayName,
        avatarUrl,
        bio,
        followerCount,
        followingCount,
        totalLikes,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: tokenExpiryDate,
      })
      .onConflictDoUpdate({
        target: users.tiktokId,
        set: {
          username: displayName,
          displayName,
          avatarUrl,
          bio,
          accessTokenEncrypted: encryptedAccessToken,
          refreshTokenEncrypted: encryptedRefreshToken,
          tokenExpiresAt: tokenExpiryDate,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!user) {
      throw new Error('Failed to persist TikTok user record');
    }

    // Create session
    await createSession(user.id);

    // Sync user data in background
    syncUserData(user.id).catch(console.error);

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_BASE_URL));
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&message=${error.message}`, process.env.NEXT_PUBLIC_BASE_URL)
    );
  }
}
