import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncUserData } from '@/lib/tiktok';

export async function POST() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncUserData(session.userId);
    return NextResponse.json({ 
      success: true, 
      message: `Synced ${result.videosCount} videos`,
      data: result 
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Sync failed', 
      message: error.message 
    }, { status: 500 });
  }
}
