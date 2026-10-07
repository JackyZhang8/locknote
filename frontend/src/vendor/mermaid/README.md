# Mermaid 11.4.1

This directory vendors the standalone Mermaid bundle for offline desktop use.
Upstream: https://unpkg.com/mermaid@11.4.1/dist/mermaid.min.js

The offline copy was obtained from the locally installed Obsidian distribution.
It carries a documented text measurement rounding patch (see its first two
lines). The final global assignment was replaced with an ES module default
export, so Vite can load the bundle on demand. No network requests are needed
to render diagrams.

SHA-256 of the vendored module:
`511270db9f7636eab3a37b1787fa09f1b81f0c0ae3d07eab812eda1fae4d6b22`

Mermaid's MIT license and DOMPurify's Apache 2.0 license are in `LICENSES.txt`.
The bundle also preserves its dependency license notices.
