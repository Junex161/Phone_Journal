import { Directory, File, Paths } from 'expo-file-system';

// Memos are kept in <documents>/memos/. The DB stores only the file name, because the
// absolute documents path can change between app updates on iOS.

export function memoDir(): Directory {
  const dir = new Directory(Paths.document, 'memos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function memoFile(fileName: string): File {
  return new File(memoDir(), fileName);
}

export function memoUri(fileName: string): string {
  return memoFile(fileName).uri;
}

/**
 * Move a finished recording into the memo folder.
 * `expectedName` is the unique name the recording was started with; the recorder's reported
 * uri must contain it, so an old/stale file can never be stored by mistake.
 */
export function storeRecording(recorderUri: string | null, expectedName: string): string {
  let src: File | null = null;
  if (recorderUri && recorderUri.includes(expectedName)) {
    src = new File(recorderUri);
  } else {
    // Fall back to the recorder's documented output folders.
    for (const sub of ['Audio', 'ExpoAudio']) {
      const dir = new Directory(Paths.document, sub);
      if (!dir.exists) continue;
      const hit = dir.list().find((f) => f instanceof File && f.name.startsWith(expectedName));
      if (hit) src = hit as File;
    }
  }
  if (!src || !src.exists) throw new Error('The recording file could not be found.');
  const ext = src.extension || '.m4a';
  const name = `${expectedName}${ext}`;
  src.moveSync(new File(memoDir(), name));
  return name;
}

export function deleteMemoFile(fileName: string): void {
  const f = memoFile(fileName);
  if (f.exists) f.delete();
}
