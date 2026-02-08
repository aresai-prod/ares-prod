import type { Organization, Pod, PodAccess, PodRole, UserRecord } from "../models/types.js";
import { findOrgById, readDb } from "../storage/db.js";

export function getUserAndOrg(userId: string): { user: UserRecord; org: Organization } {
  const db = readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error("User not found");
  }
  const org = findOrgById(db, user.orgId);
  if (!org) {
    throw new Error("Organization not found");
  }
  return { user, org };
}

export function getPod(org: Organization, podId: string): Pod {
  const pod = org.pods.find((entry) => entry.id === podId);
  if (!pod) {
    throw new Error("Pod not found");
  }
  return pod;
}

export function getUserPodAccess(user: UserRecord, podId: string): PodAccess | undefined {
  return user.podAccess.find((access) => access.podId === podId);
}

export function roleAtLeast(role: PodRole, required: PodRole): boolean {
  const order: PodRole[] = ["viewer", "editor", "admin"];
  return order.indexOf(role) >= order.indexOf(required);
}

export function canViewPod(user: UserRecord, podId: string): boolean {
  if (isOrgAdmin(user)) return true;
  const access = getUserPodAccess(user, podId);
  return Boolean(access && roleAtLeast(access.role, "viewer"));
}

export function canEditPod(user: UserRecord, podId: string): boolean {
  if (isOrgAdmin(user)) return true;
  const access = getUserPodAccess(user, podId);
  return Boolean(access && roleAtLeast(access.role, "editor"));
}

export function canAdminPod(user: UserRecord, podId: string): boolean {
  if (isOrgAdmin(user)) return true;
  const access = getUserPodAccess(user, podId);
  return Boolean(access && roleAtLeast(access.role, "admin"));
}

export function isOrgAdmin(user: UserRecord): boolean {
  return user.role === "admin";
}
