import { Directory, File, Paths } from 'expo-file-system';

// Memos are kept in <documents>/memos/. The DB stores only the file name, because the
// absolute documents path can change between app updates on iOS.

function memoDir(): Directory {
  const dir = new Directory(Paths.document, 'memos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function memoUri(fileName: string): string {
  return new File(memoDir(), fileName).uri;
}

/** Copy a fresh recording into the memo folder and return the stored file name. */
export function storeRecording(sourceUri: string, date: string, kind: string): string {
  const src = new File(sourceUri);
  const ext = src.extension || '.m4a';
  const name = `${date}_${kind}_${Date.now()}${ext}`;
  src.copySync(new File(memoDir(), name));
  try {
    src.delete();
  } catch {
    // The recorder's temp file is not important; ignore.
  }
  return name;
}

export function deleteMemoFile(fileName: string): void {
  const f = new File(memoDir(), fileName);
  if (f.exists) f.delete();
}
