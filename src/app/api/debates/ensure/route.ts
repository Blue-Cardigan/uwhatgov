import { NextRequest, NextResponse } from 'next/server';
import { ensureDebateRecord } from '@/lib/debateInitService';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { debateId } = await request.json();

    if (!debateId) {
      return NextResponse.json({ error: 'debateId is required' }, { status: 400 });
    }

    const record = await ensureDebateRecord(debateId);
    
    return NextResponse.json({ 
      success: true, 
      record,
      message: `Debate record ensured for ${debateId}` 
    });
  } catch (error: any) {
    console.error('Error ensuring debate record:', error);
    return NextResponse.json({ 
      error: 'Failed to ensure debate record',
      details: error.message 
    }, { status: 500 });
  }
} 