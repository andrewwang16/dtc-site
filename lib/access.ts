export function hasPremiumAccess(
  user: { isAdmin?: boolean; isSubscriber?: boolean } | null | undefined
): boolean {
  return Boolean(user?.isAdmin || user?.isSubscriber);
}
