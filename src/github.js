/**
 * GitHub is the deployment host for Aspera Hub (no separate server needed).
 *
 * - Updates: GitHub Releases assets (latest.json + .deb / .AppImage / .rpm)
 * - Errors:  GitHub Issues in the same (or a dedicated) repository
 * - Code:    push to this repo; ship with `npm run deploy`
 */

export const GITHUB_OWNER = 'ramchandragada';
export const GITHUB_REPO = 'AsperaDock';
export const GITHUB_SLUG = `${GITHUB_OWNER}/${GITHUB_REPO}`;

/** Base URL clients fetch: …/releases/latest/download/latest.json */
export const GITHUB_UPDATE_FEED = `https://github.com/${GITHUB_SLUG}/releases/latest/download`;

/** Issues API for auto error reports (needs a fine-grained PAT with Issues: Write). */
export const GITHUB_ISSUES_API = `https://api.github.com/repos/${GITHUB_SLUG}/issues`;

/** Browser “new issue” URL used when no token is configured. */
export const GITHUB_NEW_ISSUE_URL = `https://github.com/${GITHUB_SLUG}/issues/new`;

export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_SLUG}/releases`;
