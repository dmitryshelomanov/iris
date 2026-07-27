import { Directory, File, Paths } from 'expo-file-system';

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function documentsUriPrefix() {
  return Paths.document.uri.replace(/\/?$/, '/');
}

/** True when the URI lives under the app Documents directory. */
export function isAppDocumentUri(uri: string): boolean {
  const normalized = toFileUri(uri);
  return normalized.startsWith(documentsUriPrefix());
}

/**
 * Copy a camera capture into durable Documents/masters storage.
 * Returns a file:// URI that survives cache purge / app restart.
 */
export async function persistPhotoMaster(sourcePath: string): Promise<string> {
  const source = new File(toFileUri(sourcePath));
  if (!source.exists) {
    throw new Error('Capture file missing before master copy');
  }

  const mastersDir = new Directory(Paths.document, 'masters');
  if (!mastersDir.exists) {
    mastersDir.create({ intermediates: true, overwrite: false });
  }

  const dest = new File(mastersDir, `iris-master-${Date.now()}.jpg`);
  await source.copy(dest, { overwrite: true });

  if (!dest.exists || (dest.size ?? 0) < 1024) {
    throw new Error('Master copy failed to write JPEG');
  }

  return dest.uri;
}

/** Best-effort delete of a master (or other Documents) file. */
export function deleteAppDocumentFile(uri: string | undefined): void {
  if (!uri || !isAppDocumentUri(uri)) return;
  try {
    const file = new File(toFileUri(uri));
    if (file.exists) file.delete();
  } catch {
    // best-effort
  }
}

/** Whether a local file URI still exists on disk. */
export function fileUriExists(uri: string | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(toFileUri(uri)).exists;
  } catch {
    return false;
  }
}
