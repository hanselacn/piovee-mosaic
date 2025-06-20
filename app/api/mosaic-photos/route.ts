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
  const { photoData, timestamp, fileName } = await req.json();
  const docRef = await db.collection('mosaic-photos').add({
    photoData,
    timestamp: timestamp || Date.now(),
    fileName: fileName || '',
    used: false,
  });
  return NextResponse.json({ id: docRef.id });
}

// PATCH: Mark a photo as used
export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.collection("mosaic-photos").doc(id).update({ used: true });
  return NextResponse.json({ success: true });
}
