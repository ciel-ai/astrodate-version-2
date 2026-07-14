import { supabase } from './supabase';

/** Onboarding (upload-photos.tsx) requires at least this many before continuing --
 *  the Profile photo manager enforces the same floor on delete so a user can
 *  never drop back below what got them into the app in the first place. */
export const MIN_REQUIRED_PHOTOS = 3;
/** Enforced server-side too, by trg_user_photos_limit (enforce_user_photos_limit). */
export const MAX_PHOTOS = 6;

export interface UserPhoto {
  id: string;
  photo_url: string;
  storage_path: string;
  thumbnail_url?: string | null;
  display_order: number;
  is_primary: boolean;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
    const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const bytes3 = ((encoded3 & 3) << 6) | (encoded4 & 63);

    bytes[p++] = bytes1;
    if (p < bufferLength) bytes[p++] = bytes2;
    if (p < bufferLength) bytes[p++] = bytes3;
  }

  return arrayBuffer;
}

/** Fetches the caller's own photos, ordered by display_order, with freshly
 *  signed URLs (bucket is public so this is a defensive freshness pass, not
 *  strictly required -- matches upload-photos.tsx's original behavior). */
export async function getUserPhotos(): Promise<{ success: boolean; data?: UserPhoto[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('user_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true });

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: true, data: [] };

    const paths = data.map((p) => p.storage_path).filter((p): p is string => Boolean(p));
    const { data: signedData } = await supabase.storage
      .from('user-photos')
      .createSignedUrls(paths, 86400);

    const withUrls = data.map((photo) => {
      const signed = signedData?.find((s) => s.path === photo.storage_path);
      return { ...photo, photo_url: signed?.signedUrl || photo.photo_url };
    });

    return { success: true, data: withUrls as UserPhoto[] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Uploads one photo. Caller supplies `base64` from expo-image-picker's asset
 *  (requested with `base64: true`) -- matches upload-photos.tsx's existing
 *  onboarding flow rather than introducing a separate file-read path. */
export async function uploadUserPhoto(params: {
  uri: string;
  base64: string;
  displayOrder: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const existing = await getUserPhotos();
    if (existing.success && (existing.data?.length ?? 0) >= MAX_PHOTOS) {
      return { success: false, error: `You can have at most ${MAX_PHOTOS} photos.` };
    }

    const arrayBuffer = base64ToArrayBuffer(params.base64);
    const fileExt = params.uri.split('.').pop() || 'jpg';
    // Date.now() here runs inside a user-initiated action, not during render.
    const fileName = `${Date.now()}_${params.displayOrder}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-photos')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      });
    if (uploadError) return { success: false, error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage.from('user-photos').getPublicUrl(filePath);

    // Primary is whichever photo lands first, not whichever fills slot 0 --
    // matches upload-photos.tsx's existing rule.
    const isFirstPhoto = !(existing.data ?? []).some((p) => p.is_primary);

    const { error: dbError } = await supabase.from('user_photos').insert({
      user_id: user.id,
      photo_url: publicUrl,
      storage_path: filePath,
      display_order: params.displayOrder,
      is_primary: isFirstPhoto,
    });

    if (dbError) {
      // The storage object already succeeded -- remove it so it doesn't become
      // a permanently orphaned file with no DB row pointing to it.
      await supabase.storage.from('user-photos').remove([filePath]).catch(() => {});
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Deletes a photo. Refuses below MIN_REQUIRED_PHOTOS instead of silently
 *  succeeding -- Phase 4's photo manager surfaces `error` as the reason. */
export async function deleteUserPhoto(photo: UserPhoto): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getUserPhotos();
    const currentCount = existing.data?.length ?? 0;
    if (currentCount <= MIN_REQUIRED_PHOTOS) {
      return {
        success: false,
        error: `You need at least ${MIN_REQUIRED_PHOTOS} photos. Add another before removing this one.`,
      };
    }

    await supabase.storage.from('user-photos').remove([photo.storage_path]);
    const { error } = await supabase.from('user_photos').delete().eq('id', photo.id);
    if (error) return { success: false, error: error.message };

    // If the primary photo was just removed, promote the next one so the
    // profile never ends up with zero primary photos.
    if (photo.is_primary) {
      const remaining = existing.data?.filter((p) => p.id !== photo.id) ?? [];
      const next = remaining[0];
      if (next) await setPrimaryPhoto(next.id);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Swaps display_order between two of the caller's own photos -- the
 *  reorder primitive the Profile photo grid's ‹ › controls use. Two
 *  sequential updates, not a single transaction: user_photos has no unique
 *  constraint on (user_id, display_order), so a briefly-duplicate order
 *  between the two writes is harmless, and this stays a plain owner-scoped
 *  client call like the rest of this file rather than needing an RPC. */
export async function swapPhotoOrder(photoA: UserPhoto, photoB: UserPhoto): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: errorA } = await supabase
      .from('user_photos')
      .update({ display_order: photoB.display_order })
      .eq('id', photoA.id);
    if (errorA) return { success: false, error: errorA.message };

    const { error: errorB } = await supabase
      .from('user_photos')
      .update({ display_order: photoA.display_order })
      .eq('id', photoB.id);
    if (errorB) return { success: false, error: errorB.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Sets one photo as primary and unsets all others for the caller. Two
 *  sequential owner-scoped updates rather than a single RPC -- RLS already
 *  restricts both to the caller's own rows, and this mirrors the pattern
 *  the legacy project's setPrimaryPhoto used. */
export async function setPrimaryPhoto(photoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error: clearError } = await supabase
      .from('user_photos')
      .update({ is_primary: false })
      .eq('user_id', user.id);
    if (clearError) return { success: false, error: clearError.message };

    const { error: setError } = await supabase
      .from('user_photos')
      .update({ is_primary: true })
      .eq('id', photoId);
    if (setError) return { success: false, error: setError.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
