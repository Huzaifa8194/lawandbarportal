"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadPortalFile(pathPrefix: string, file: File) {
  const path = `${pathPrefix}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { path, url };
}

export async function deletePortalFile(path?: string) {
  if (!path) return;
  await deleteObject(ref(storage, path));
}
