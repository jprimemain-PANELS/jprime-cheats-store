# v14 - Low CPU (stops the Vercel "Fluid Active CPU" pause)
Cause: every page view asked the database for the store, branding and options, and every visitor's browser refreshed the activity box every 20 s.
Changes (no SQL, no env changes, no visible change for customers):
- Store, branding and store-options are kept in memory for 60 seconds (edits clear them at once on the same server; other servers refresh within 60 s).
- Recent-activity box refreshes every 60 s instead of 20 s.
Upload this over your GitHub code like any other version. Tests: 206 passing.
