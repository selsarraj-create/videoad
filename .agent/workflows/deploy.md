---
description: how to deploy changes to production (Vercel)
---
// turbo-all

After making any code changes, always commit and push to trigger a Vercel deployment:

1. Stage all changes
```bash
cd /Users/sayfelsarraj/Documents/GitHub/videoads && git add -A
```

2. Commit with a descriptive message
```bash
git commit -m "<descriptive commit message>"
```

3. Push to main
```bash
git push origin main
```

4. The site is live at https://videoad-mu.vercel.app — Vercel auto-deploys from the `main` branch. Allow ~60-90 seconds for the build.

**Important**: The user is NOT running locally. All testing happens on the Vercel deployment. Always push after changes.
