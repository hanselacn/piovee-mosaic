import { NextRequest, NextResponse } from 'next/server';
import { isServiceAccountConfigured } from '@/lib/google-service-account';

export async function GET() {
  try {
    const serviceAccountConfigured = isServiceAccountConfigured();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        firebase: {
          configured: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
          parsed: false
        },
        googleDrive: {
          serviceAccount: serviceAccountConfigured,
          folderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID
        },
        pusher: {
          configured: !!(process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET)
        }
      }
    };

    // Try to parse Firebase service account
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        health.services.firebase.parsed = true;
      }
    } catch (error) {
      console.error('Firebase service account JSON parse error:', error);
    }

    return NextResponse.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
