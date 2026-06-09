import { adminStorage } from "@/lib/firebase-admin";

export async function deleteStoragePaths(paths: string[] | undefined) {
  if (!paths?.length) return;
  const unique = [...new Set(paths.filter(Boolean))];
  await Promise.all(
    unique.map(async (filePath) => {
      try {
        await adminStorage.bucket().file(filePath).delete();
      } catch {
        // Missing file or permission — continue cleanup
      }
    }),
  );
}

export function uniquePaths(...groups: Array<string[] | string | undefined>) {
  const paths = new Set<string>();
  for (const group of groups) {
    if (!group) continue;
    if (typeof group === "string") {
      if (group) paths.add(group);
      continue;
    }
    for (const path of group) {
      if (path) paths.add(path);
    }
  }
  return [...paths];
}
