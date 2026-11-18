# Ремонт Студио: fixed version (NS-H5CQ)

Fixed copy of https://konkurs-zadacha.vercel.app/ for the Нов Свят Дигитал contest.

- `mirror/` is the site itself. The first commit is an untouched copy of the live site;
  every later commit is one fix, named after its number in the review report.
- `scripts/` is the website-duplicator toolkit (see `docs/website-duplicator.md`).

## Commands

```bash
node scripts/capture.js --url https://konkurs-zadacha.vercel.app/ --max-routes 60   # re-copy the live site
node scripts/rewrite.js --url https://konkurs-zadacha.vercel.app/                   # point links at the local copy
node scripts/serve.js                                                               # preview locally
node scripts/verify.js --url https://konkurs-zadacha.vercel.app/                    # check for 404s and leaks
```
