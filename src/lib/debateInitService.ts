import { createClient } from '@/lib/supabase/server';

export interface DebateRecord {
  id: string;
  status: string;
  content: string | null;
  summary: string | null;
  created_at: string;
  last_updated_at: string;
  error_message: string | null;
}

/**
 * Ensures a debate record exists in casual_debates_uwhatgov table
 * This enables chat functionality for any debate, regardless of casual generation status
 */
export async function ensureDebateRecord(debateId: string): Promise<DebateRecord> {
  const supabase = createClient();
  
  // First, check if record already exists
  const { data: existingRecord, error: selectError } = await supabase
    .from('casual_debates_uwhatgov')
    .select('*')
    .eq('id', debateId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    throw new Error(`Failed to check debate record: ${selectError.message}`);
  }

  if (existingRecord) {
    return existingRecord as DebateRecord;
  }

  // Record doesn't exist, create a placeholder
  try {
    const newRecord = {
      id: debateId,
      status: 'not_generated',
      content: null,
      summary: null,
      error_message: null
    };

    const { data: createdRecord, error: insertError } = await supabase
      .from('casual_debates_uwhatgov')
      .insert(newRecord)
      .select()
      .single();

    if (insertError) {
      // Handle race condition - record might have been created by another request
      if (insertError.code === '23505') { // Unique violation
        const { data: racedRecord } = await supabase
          .from('casual_debates_uwhatgov')
          .select('*')
          .eq('id', debateId)
          .single();
        
        if (racedRecord) {
          return racedRecord as DebateRecord;
        }
      }
      throw new Error(`Failed to create debate record: ${insertError.message}`);
    }

    return createdRecord as DebateRecord;
  } catch (error: any) {
    // If main record creation fails, create minimal record
    const fallbackRecord = {
      id: debateId,
      status: 'not_generated',
      content: null,
      summary: null,
      error_message: `Failed to create debate record: ${error.message}`
    };

    const { data: createdRecord, error: insertError } = await supabase
      .from('casual_debates_uwhatgov')
      .insert(fallbackRecord)
      .select()
      .single();

    if (insertError && insertError.code !== '23505') {
      throw new Error(`Failed to create fallback debate record: ${insertError.message}`);
    }

    return createdRecord as DebateRecord;
  }
}

/**
 * Updates debate record status (used by the generation system)
 */
export async function updateDebateStatus(
  debateId: string, 
  status: string, 
  content?: string | null,
  errorMessage?: string | null
): Promise<void> {
  const supabase = createClient();
  
  const updateData: Partial<DebateRecord> = {
    status
  };

  if (content !== undefined) {
    updateData.content = content;
  }
  
  if (errorMessage !== undefined) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('casual_debates_uwhatgov')
    .update(updateData)
    .eq('id', debateId);

  if (error) {
    throw new Error(`Failed to update debate status: ${error.message}`);
  }
} 