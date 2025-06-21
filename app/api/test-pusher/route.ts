import { triggerPusherEvent } from '@/lib/pusher-server';
import { NextResponse } from 'next/server';

// OPTIONS: Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST() {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    await triggerPusherEvent('camera-channel', 'photo-uploaded', {
      fileName: `photo-${Date.now()}.jpg`,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error('Error triggering Pusher event:', error);
    return NextResponse.json({ 
      error: `Failed to trigger Pusher event: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
