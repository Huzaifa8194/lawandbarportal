import { adminDb } from "@/lib/firebase-admin";
import { userHasSqeBundlePurchase } from "@/app/api/admin/_lib/sqe-bundle-purchase";

export type PortalAccessReason = "ok" | "no_user" | "admin_disabled" | "no_bundle";

export type PortalAccessState = {
  allowed: boolean;
  isAdmin: boolean;
  reason: PortalAccessReason;
};

/**
 * Portal access:
 * - `accessEnabled === false` → blocked (admin disabled).
 * - `accessEnabled === true` → allowed for students (admin godmode; no bundle/code required).
 * - `accessEnabled` unset → students need SQE bundle purchase or `portalAccessViaCode`.
 * - Admins: allowed unless explicitly disabled.
 */
export async function getPortalAccessState(uid: string): Promise<PortalAccessState> {
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { allowed: false, isAdmin: false, reason: "no_user" };
  }

  const data = userDoc.data() as {
    isAdmin?: boolean;
    accessEnabled?: boolean;
    email?: string;
    portalAccessViaCode?: boolean;
  };

  const isAdmin = Boolean(data?.isAdmin);
  const accessNotExplicitlyDisabled = data?.accessEnabled !== false;

  if (!accessNotExplicitlyDisabled) {
    return { allowed: false, isAdmin, reason: "admin_disabled" };
  }

  if (isAdmin) {
    return { allowed: true, isAdmin: true, reason: "ok" };
  }

  if (data?.accessEnabled === true) {
    return { allowed: true, isAdmin: false, reason: "ok" };
  }

  if (data?.portalAccessViaCode === true) {
    return { allowed: true, isAdmin: false, reason: "ok" };
  }

  const email = typeof data.email === "string" ? data.email : "";
  const purchased = await userHasSqeBundlePurchase(adminDb, email);
  if (!purchased) {
    return { allowed: false, isAdmin: false, reason: "no_bundle" };
  }

  return { allowed: true, isAdmin: false, reason: "ok" };
}
