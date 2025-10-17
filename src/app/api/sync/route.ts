import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized',
      errorCode: 'USER_NOT_AUTHENTICATED'
    }, { status: 401 });
  }

  try {
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      throw new Error('BACKEND_API_URL is not configured');
    }

    const response = await fetch(`${backendUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: session.userId }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Backend sync failed',
        errorCode: result.errorCode || 'API_ERROR'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${result.data.videosCount} videos`,
      data: result.data
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      message: error.message,
      errorCode: 'UNKNOWN'
    }, { status: 500 });
  }
}
