import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Test database connection
    const result = await db.execute(sql`SELECT NOW()`);
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      services: {
        gemini: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'configured' : 'missing',
        tiktok: process.env.TIKTOK_CLIENT_KEY ? 'configured' : 'missing',
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
    }, { status: 500 });
  }
}
