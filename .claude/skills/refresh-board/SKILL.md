---
name: refresh-board
description: Pull fresh data from the live Supabase job board and republish the shared "NCS Job Board — Full Job List" artifact in place, so the link already sent to stakeholders (e.g. Zack) shows current statuses.
---

# Refresh the NCS job board artifact

The published artifact lives at:
**https://claude.ai/code/artifact/5d01b85d-9432-4887-b8df-0bf32218c5d1**

It has been shared as "Anyone with the link" — do not create a new artifact URL. Always update this one in place via the `url` parameter.

## Steps

1. Generate a fresh HTML report from live Supabase data (read-only, SELECT-only, safe to run anytime):

   ```
   node scripts/generate-job-board-report.mjs "<scratchpad>/job-board-report.html"
   ```

   Replace `<scratchpad>` with this session's scratchpad directory. Run it from the repo root (`NCS-Board-React`) so it can find `.env` and the template file.

2. Publish it with the Artifact tool:
   - `file_path`: the generated HTML file from step 1
   - `url`: `https://claude.ai/code/artifact/5d01b85d-9432-4887-b8df-0bf32218c5d1`
   - Leave `title`/`description`/`favicon` unset — they carry over from the existing artifact.

3. Report back the refreshed totals (the script prints total + per-board counts to stdout) and flag anything that changed since the last refresh (e.g. a status flip, a new job ID).

## Notes

- If asked to also *update* board data (not just refresh the report), that's a separate, non-read-only operation — confirm the exact field/status change with the user first, apply it via a targeted Supabase update, then run this refresh flow to republish.
- `npm run board-report -- <output-path>` is a shorthand for step 1.
- `npm run board-snapshot` gives a quick console-only summary (counts per board/status) without generating HTML — useful for a fast check that doesn't need publishing.
