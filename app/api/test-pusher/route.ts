import { triggerPusherEvent } from '@/lib/pusher-server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    await triggerPusherEvent('camera-channel', 'photo-uploaded', {
      fileName: `photo-${Date.now()}.jpg`,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error triggering Pusher event:', error);
    return NextResponse.json({ error: 'Failed to trigger Pusher event' }, { status: 500 });
  }
}
