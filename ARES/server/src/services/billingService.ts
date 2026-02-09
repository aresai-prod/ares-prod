import type { AccountType, License, LicenseTier, Organization, TokenBucket } from "../models/types.js";

const DEFAULT_FREE_TOKENS = 20000;
const DEFAULT_INDIVIDUAL_TOKENS = 200000;
const DEFAULT_BUSINESS_TOKENS = 1000000;

export function getTokenLimit(tier: LicenseTier): number {
  const free = Number(process.env.FREE_TOKEN_LIMIT ?? DEFAULT_FREE_TOKENS);
  const individual = Number(process.env.INDIVIDUAL_TOKEN_LIMIT ?? DEFAULT_INDIVIDUAL_TOKENS);
  const business = Number(process.env.BUSINESS_TOKEN_LIMIT ?? DEFAULT_BUSINESS_TOKENS);
  if (tier === "FREE") return free;
  if (tier === "INDIVIDUAL") return individual;
  return business;
}

export function createTokenBucket(tier: LicenseTier): TokenBucket {
  const now = new Date();
  const resetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    limit: getTokenLimit(tier),
    used: 0,
    resetAt: resetAt.toISOString()
  };
}

export function createLicense(accountType: AccountType, tier?: LicenseTier): License {
  const resolvedTier = tier ?? (accountType === "BUSINESS" ? "BUSINESS" : "FREE");
  const pricePerSeat =
    resolvedTier === "FREE" ? 0 : accountType === "BUSINESS" ? 1 : 1;
  return {
    tier: resolvedTier,
    status: "active",
    tokenBucket: createTokenBucket(resolvedTier),
    seats: accountType === "BUSINESS" ? 1 : 1,
    pricePerSeat,
    startedAt: new Date().toISOString()
  };
}

export function resetTokenBucketIfNeeded(license: License): License {
  const now = new Date();
  if (new Date(license.tokenBucket.resetAt).getTime() > now.getTime()) {
    return license;
  }
  return {
    ...license,
    tokenBucket: createTokenBucket(license.tier)
  };
}

export function canUseTokens(org: Organization, tokens: number): boolean {
  const refreshed = resetTokenBucketIfNeeded(org.license);
  return refreshed.tokenBucket.used + tokens <= refreshed.tokenBucket.limit;
}

export function consumeTokens(org: Organization, tokens: number): Organization {
  const refreshed = resetTokenBucketIfNeeded(org.license);
  return {
    ...org,
    license: {
      ...refreshed,
      tokenBucket: {
        ...refreshed.tokenBucket,
        used: refreshed.tokenBucket.used + tokens
      }
    },
    updatedAt: new Date().toISOString()
  };
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function upgradeAvailableAt(createdAt: string): Date {
  const start = new Date(createdAt);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function canUpgrade(createdAt: string, whitelisted?: boolean): boolean {
  return true;
}
