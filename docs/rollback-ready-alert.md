# Readiness notice rollback

Before this change: ec9e248c97b6f56351bbd697f02c79784c7b5a9f
Backup branch: backup/before-ready-alert-20261111

The feature is isolated in one commit. Revert that feature commit to remove only the readiness notice without rolling back newer market observations. Do not reset main to the backup branch: that could discard newer data or later changes.

If restoring manually, restore only public/index.html, public/shared-data.js, public/sw.js, tests/navigation-live.mjs and .github/workflows/verify-navigation.yml from the backup, and remove public/page-ready-alert.js, public/page-ready-alert.css and tests/ready-alert.test.js. Commit and push the restoration to run the normal deployment.

For a temporary per-visit hide, open the indicator page with ?ready-alert=off. This hides the new notice while preserving background preparation.
