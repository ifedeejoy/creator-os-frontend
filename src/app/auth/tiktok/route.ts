import { NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';
import { getTikTokRedirectUri } from '@/lib/tiktok';

export async function GET() {
  const csrfState = Math.random().toString(36).substring(2);

  // PKCE flow
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const clientKey = process.env.TIKTOK_CLIENT_KEY!;
  const redirectUri = getTikTokRedirectUri();

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('scope', 'user.info.basic,video.list,user.info.profile,user.info.stats');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', csrfState);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());

  // Store state and code_verifier in cookies for validation
  response.cookies.set('tiktok_oauth_state', csrfState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  response.cookies.set('tiktok_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
