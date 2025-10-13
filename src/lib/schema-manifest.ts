export const schemaManifest = `
# Analytics Schema Manifest (read-only)

## videos
- id (uuid): internal identifier
- user_id (uuid): owner of the video (scoped to current tenant/session)
- tiktok_video_id (text): TikTok video identifier
- description (text): video caption text
- view_count (integer)
- like_count (integer)
- comment_count (integer)
- share_count (integer)
- engagement_rate (numeric, %)
- video_created_at (timestamp)
- source (jsonb, optional metadata)

## daily_metrics
- id (uuid)
- user_id (uuid)
- date (date, YYYY-MM-DD)
- total_views (integer)
- total_likes (integer)
- total_comments (integer)
- total_shares (integer)
- follower_count (integer, closing followers for the day)
- avg_engagement_rate (numeric, %)

## creators
- id (uuid)
- tiktok_id (text)
- username (text)
- follower_count (integer)
- following_count (integer)
- total_likes (bigint)
- video_count (integer)
- bio (text)
- profile_data (jsonb, scraper metadata)
- last_scraped_at (timestamp)

## Usage Rules
1. Always scope analytics queries by the authenticated user's \`user_id\`.
2. Never attempt INSERT/UPDATE/DELETE; assistant has read-only access.
3. Prefer aggregated data from \`daily_metrics\` for trend questions.
4. When searching creators, combine follower_count ranges with textual filters when available.
5. If requested data is unavailable, respond with a helpful explanation instead of fabricating numbers.
`;
