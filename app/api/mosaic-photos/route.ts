import { db } from '@/lib/firestore';
import { NextRequest, NextResponse } from 'next/server';

// GET: List all photos (optionally filter by ?used=false)
export async function GET(req: NextRequest) {
  const used = req.nextUrl.searchParams.get('used');
  let query: FirebaseFirestore.CollectionReference | FirebaseFirestore.Query = db.collection('mosaic-photos');
  if (used !== null) {
    query = query.where('used', '==', used === 'true');
  }
  const snapshot = await query.orderBy('timestamp', 'asc').get();
  const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ photos });
}

// POST: Add a new photo
export async function POST(req: NextRequest) {
  const { photoData, timestamp, fileName, tileIndex } = await req.json();
  const docRef = await db.collection('mosaic-photos').add({
    photoData,
    timestamp: timestamp || Date.now(),
    fileName: fileName || '',
    tileIndex: tileIndex || null, // Store which tile this photo is placed on
    used: false,
  });
  return NextResponse.json({ id: docRef.id });
}

// PATCH: Mark a photo as used and update tile position
export async function PATCH(req: NextRequest) {
  const { id, tileIndex } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  
  const updateData: any = { used: true };
  if (tileIndex !== undefined) {
    updateData.tileIndex = tileIndex;
  }
  
  await db.collection("mosaic-photos").doc(id).update(updateData);
  return NextResponse.json({ success: true });
}
