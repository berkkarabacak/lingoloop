# Asset and dependency credits

## Placeholder media

The 24 posters and MP4 clips in `server/media/` are generated locally by `content/scripts/make-posters.py` and `content/scripts/make-media.mjs`. They contain only programmatic shapes, text, and silent audio. They are marked as generated placeholders in the product and may be replaced through the content studio.

## Typography in generated posters

- **Noto Sans SC Regular** — used only when rendering placeholder posters.
- Source: the verified local Kimi runtime font bundle, copied to `content/assets/NotoSansSC-Regular.ttf` with this project.
- Noto fonts are distributed by Google under the **SIL Open Font License 1.1**. Keep this attribution with redistributed font files.

The application itself uses platform system fonts, not the bundled Noto font.

## Framework and media generation

- Expo, React Native, Expo Router, Expo Video, Hono, and other npm dependencies retain their respective licenses.
- Placeholder video encoding uses the `ffmpeg-static` npm package and FFmpeg. FFmpeg is available under LGPL/GPL depending on its build configuration; review the package's bundled license before redistribution.
- The Expo blank TypeScript template's original license is retained as `mobile/LICENSE`.

No third-party footage, movie scenes, podcast excerpts, or unlicensed learning videos are included.
