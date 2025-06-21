import { db } from '@/lib/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { uploadPhotoWithServiceAccount, getFileContentWithServiceAccount, isServiceAccountConfigured } from '@/lib/google-service-account';

// GET: List all photos (optionally filter by ?used=false) with Google Drive data
export async function GET(req: NextRequest) {
  try {
    if (!isServiceAccountConfigured()) {
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 });
    }

    const used = req.nextUrl.searchParams.get('used');
    let query: FirebaseFirestore.CollectionReference | FirebaseFirestore.Query = db.collection('mosaic-photos');
    if (used !== null) {
      query = query.where('used', '==', used === 'true');
    }
    const snapshot = await query.orderBy('timestamp', 'asc').get();
    
    // Get photo metadata from Firestore
    const photoMetadata = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch actual photo data from Google Drive for each photo
    const photos = await Promise.all(
      photoMetadata.map(async (photo: any) => {
        try {
          if (photo.fileId) {
            // Get photo data from Google Drive
            const photoData = await getFileContentWithServiceAccount(photo.fileId);
            return {
              ...photo,
              photoData, // Add the actual image data from Google Drive
            };
          }
          return photo; // Return without photoData if no fileId
        } catch (error) {
          console.error(`Error fetching photo data for ${photo.id}:`, error);
          return photo; // Return metadata even if photo fetch fails
        }
      })
    );
    
    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Error getting mosaic photos:', error);
    return NextResponse.json({ error: 'Failed to get photos' }, { status: 500 });
  }
}

// POST: Add a new photo to Google Drive and store metadata in Firestore
export async function POST(req: NextRequest) {
  try {
    // Add CORS headers for better browser compatibility
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (!isServiceAccountConfigured()) {
      console.error("Service account not configured");
      return NextResponse.json({ error: "Service account not configured" }, { status: 503, headers });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400, headers });
    }

    const { photoData, timestamp, fileName, tileIndex } = body;
    
    if (!photoData) {
      return NextResponse.json({ error: "No photo data provided" }, { status: 400, headers });
    }

    // Validate photo data format
    if (!photoData.startsWith('data:image/')) {
      return NextResponse.json({ error: "Invalid photo data format" }, { status: 400, headers });
    }

    // Generate unique filename if not provided
    const finalFileName = fileName || `mosaic-photo-${Date.now()}.jpg`;
    
    console.log(`📤 Uploading mosaic photo to Google Drive: ${finalFileName}`);
    
    // Upload photo to Google Drive with error handling
    let fileId: string;
    try {
      fileId = await uploadPhotoWithServiceAccount(
        photoData, 
        finalFileName, 
        process.env.GOOGLE_DRIVE_FOLDER_ID!
      );
    } catch (uploadError) {
      console.error('Google Drive upload failed:', uploadError);
      return NextResponse.json({ 
        error: `Failed to upload to Google Drive: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}` 
      }, { status: 500, headers });
    }
    
    console.log(`✅ Photo uploaded to Google Drive: ${fileId}`);
      // Store metadata in Firestore (without the large photo data)
    let docRef;
    try {
      docRef = await db.collection('mosaic-photos').add({
        fileId, // Google Drive file ID
        fileName: finalFileName,
        timestamp: timestamp || Date.now(),
        tileIndex: tileIndex || null,
        used: false,
      });
    } catch (firestoreError) {
      console.error('Firestore save failed:', firestoreError);
      return NextResponse.json({ 
        error: `Failed to save to Firestore: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}` 
      }, { status: 500, headers });
    }
    
    console.log(`✅ Photo metadata saved to Firestore: ${docRef.id}`);
    
    return NextResponse.json({ id: docRef.id, fileId }, { headers });
  } catch (error) {
    console.error('Error adding mosaic photo:', error);
    return NextResponse.json({ 
      error: `Failed to add photo: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
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

// DELETE: Reset all mosaic photos (clear Firestore data but keep Google Drive files)
export async function DELETE(req: NextRequest) {
  try {
    console.log('🗑️ Resetting all mosaic photos from Firestore...');
    
    // Get all photos from Firestore
    const snapshot = await db.collection('mosaic-photos').get();
    
    // Delete all photo documents from Firestore
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`✅ Reset complete: Deleted ${snapshot.docs.length} photo records from Firestore`);
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: snapshot.docs.length,
      message: "All mosaic photos reset successfully" 
    });
  } catch (error) {
    console.error('Error resetting mosaic photos:', error);
    return NextResponse.json({ error: 'Failed to reset mosaic photos' }, { status: 500 });
  }
}

// OPTIONS: Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
