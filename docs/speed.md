# Speed pass

Measured with Lighthouse 12 on mobile, devtools throttling (slow 4G, 4x CPU), served
compressed with `serve`. Before = commit c2541df, after = this commit.
Re-run: `LH_EXTRA="--throttling-method=devtools" scripts/lh.sh http://localhost:8090 label /`.

| Page (mobile) | Score | LCP | Bytes |
|---|---|---|---|
| Homepage | 52 -> 58 | 3.7 s -> 2.9 s | 2346 -> 2213 KB |
| Service page (tsyalosten) | 86 -> 94 | 3.7 s -> 2.5 s | 501 -> 405 KB |
| Contacts | 90 -> 91 | 2.9 s -> 2.8 s | 347 -> 346 KB |
| 3D process | 65 -> 64-65 | 2.4 s -> 2.4 s | 2121 -> 2083 KB |
| Configurator | 56 -> 55 | 3.0 s -> 3.0 s | 2125 -> 2088 KB |

Without throttling (fast network), homepage first paint went from 4.3 s to 1.75 s:
the 800 KB 3D bundle no longer runs before the page paints.

## What changed (`scripts/speed.py`)
- 3D bundles (nachalo/proces/konstruktor.js) are preloaded at low priority and run
  after the page's load event, so the poster / loader paints first.
- Phones rendered the 3D at 2x pixel density (more than desktop's 1.75x); now 1.5x
  (about 44% fewer pixels per frame on a 3x phone).
- 960px step added to the service images (phones were getting the 1280px file; it is
  the LCP image on the homepage and service pages).
- The 700-byte @font-face stylesheet is inlined (one fewer render-blocking request).
- Every CSS/JS URL carries ?v=<content hash>; `mirror/vercel.json` caches CSS/JS/fonts
  for a year and images for 30 days. The live site sends `max-age=0, must-revalidate`
  for everything, so every file is re-checked on every page view.
- Large 3D colour textures recompressed (-37 KB; they were already well compressed).

## What is left
The 3D pages stay heavy (about 2 MB, long main-thread tasks): each page ships its own
~800 KB bundle that includes three.js, and the textures are ~1.5 MB. Splitting or
slimming those needs the original source code, not the minified bundles.
Headless Lighthouse renders WebGL on the CPU (SwiftShader), which overstates the
blocking time compared with a real phone GPU.
