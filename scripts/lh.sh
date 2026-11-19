#!/bin/bash
# Lighthouse performance runs: scripts/lh.sh <base-url> <label> [routes...]
# Writes reports/lh-<label>-<slug>-<formfactor>.json and prints the key numbers.
BASE="$1"; LABEL="$2"; shift 2
ROUTES=${@:-"/ /kontakti/ /uslugi/tsyalosten-remont-na-zhilishte/ /proces/ /konstruktor/"}
cd "$(dirname "$0")/.." && mkdir -p reports
for r in $ROUTES; do
  slug=$(echo "$r" | sed 's#^/##; s#/$##; s#/#__#g'); [ -z "$slug" ] && slug=home
  for ff in mobile desktop; do
    extra=""; [ "$ff" = desktop ] && extra="--preset=desktop"
    out="reports/lh-$LABEL-$slug-$ff.json"
    npx lighthouse "$BASE$r" --quiet --only-categories=performance $extra $LH_EXTRA \
      --chrome-flags="--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader" \
      --output=json --output-path="$out" >/dev/null 2>&1
    node -e '
      const r=require("./'"$out"'"); const a=r.audits;
      const v=k=>a[k]&&a[k].numericValue;
      console.log([process.argv[1].padEnd(46), "score", Math.round(r.categories.performance.score*100),
        "FCP", (v("first-contentful-paint")/1000).toFixed(1)+"s",
        "LCP", (v("largest-contentful-paint")/1000).toFixed(1)+"s",
        "TBT", Math.round(v("total-blocking-time"))+"ms",
        "CLS", (v("cumulative-layout-shift")||0).toFixed(3),
        "bytes", Math.round(v("total-byte-weight")/1024)+"KB"].join(" "))' "$LABEL $r $ff"
  done
done
