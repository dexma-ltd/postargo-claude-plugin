// API shapes used by the CLI (subset of the repo's shared/types.ts, copied so the package builds on its own).
/** views, else impressions, else reach (what engagement rate is measured against). */
export const exposure = (m) => (m ? m.views ?? m.impressions ?? m.reach ?? null : null);
export const CAMPAIGN_DATA_NOTE = "App Store numbers come from Apple App Analytics (via Revflare): they lag 2-3 days, Apple withholds small numbers (fewer than 5 users) for privacy, and proceeds are Apple's estimate.";
/** Platforms whose captions are not clickable: they use the account's bio link (shared/campaigns.ts). */
export const BIO_LINK_PLATFORMS = new Set(["instagram", "instagram_standalone", "tiktok", "tiktok_business"]);
