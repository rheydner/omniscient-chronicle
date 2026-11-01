import { supabase } from './supabase';

export type ChronicleAssetFolder = 'entities' | 'documents' | 'maps' | 'bestiary';

export async function uploadChronicleAsset(
  roomId: string,
  category: ChronicleAssetFolder,
  file: File
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const safeRoom = roomId || 'global-room';
    const filePath = `chronicle/${safeRoom}/${category}/${fileName}`;

    const { error } = await supabase.storage
      .from('vtt-assets')
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error('[Chronicle Storage] Upload error:', error);
      return null;
    }

    const { data } = supabase.storage.from('vtt-assets').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error('[Chronicle Storage] Unexpected upload error:', err);
    return null;
  }
}

export async function pingSupabaseKeepAlive(): Promise<void> {
  try {
    await supabase.storage.from('vtt-assets').list('', { limit: 1 });
  } catch (err) {
    console.debug('[Supabase Keep-Alive] Ping executado:', err);
  }
}
