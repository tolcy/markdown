# Third-party notices / 第三方声明

Tolcy's own code is MIT-licensed. This does not relicense bundled third-party components. Their original notices, license texts, and applicable conditions continue to apply.

Tolcy 自有代码使用 MIT 许可证；该许可证不替代第三方组件的原始许可证。分发源码或安装包时，请同时保留本文件和 `licenses/` 中的声明。

## Main components / 主要组件

| Component | License | Source |
| --- | --- | --- |
| Tauri and official plugins | MIT OR Apache-2.0, as declared by each package | https://github.com/tauri-apps/tauri |
| RustCrypto AES-GCM and Argon2 | Apache-2.0 OR MIT | https://github.com/RustCrypto |
| Vditor 3.11.2 | MIT | https://github.com/Vanessa219/vditor/tree/v3.11.2 |
| Lute 1.7.6 | MulanPSL-2.0 | https://github.com/88250/lute/tree/v1.7.6 |
| Highlight.js | BSD-3-Clause | https://github.com/highlightjs/highlight.js |
| Apache ECharts / ZRender | Apache-2.0 / BSD-3-Clause, respectively | https://github.com/apache/echarts |
| KaTeX and associated fonts | See preserved upstream notices | https://github.com/KaTeX/KaTeX |
| MathJax | Apache-2.0 | https://github.com/mathjax/MathJax |
| Mermaid and its embedded dependencies | MIT and individual embedded dependency licenses | https://github.com/mermaid-js/mermaid |
| ABCJS, Flowchart.js, Raphael, Markmap, D3, Prism, SmilesDrawer | See individual notices | See `licenses/frontend-index.json` |
| PlantUML encoder | MIT; the encoder is distinct from a PlantUML server | https://github.com/markushedvall/plantuml-encoder |
| Viz.js 2.1.2 | MIT, with separately licensed embedded components | https://github.com/mdaines/viz.js/tree/v2.1.2 |
| Graphviz 2.40.1 within Viz.js | EPL-1.0 | https://gitlab.com/graphviz/graphviz/-/tree/2.40.1 |
| Expat and zlib within Viz.js | MIT / Zlib | See `licenses/Graphviz-viz.js-distribution-header.txt` |

## Graphviz source availability / Graphviz 源码获取

The unmodified Graphviz object code in Vditor's Viz.js distribution remains subject to EPL-1.0. It is not covered by Tolcy's MIT license. The EPL-1.0 text is in `licenses/EPL-1.0.txt`.

Corresponding Graphviz 2.40.1 source:

- https://gitlab.com/graphviz/graphviz/-/tree/2.40.1
- https://gitlab.com/graphviz/graphviz/-/archive/2.40.1/graphviz-2.40.1.tar.gz

Viz.js 2.1.2 build sources and scripts:

- https://github.com/mdaines/viz.js/tree/v2.1.2

Graphviz、Viz.js 及其内嵌依赖未由 Tolcy 修改；上述地址提供对应源码和构建脚本。第三方组件按各自许可证规定“按原样”提供，不作担保，作者及贡献者不承担适用许可证所排除的责任。

## License files / 许可证文件

- `licenses/frontend/`: upstream frontend license and notice texts. The index's `referenceVersion` records the package used to obtain a notice. Where a version is not exposed by the bundle, this is a license reference, not an exact identification of every bundled dependency.
- `licenses/rust/`: notices from the locked Windows Rust dependency graph, including build dependencies. `rust-index.json` lists versions and declared licenses. Supplementary upstream license files cover packages that place notices at the repository root.
- Embedded dependency notices within vendor JavaScript are retained unchanged.
- Some components use licenses such as MPL-2.0 or Unicode-3.0. Refer to their notices and upstream sources; the entire installer is not exclusively MIT-licensed.

`frontend-index.json` 的参考版本用于追溯许可证文本来源，不代表已精确识别所有内嵌依赖版本。本目录是随附声明汇编，并非完整法律审计或完整 SBOM。

Microsoft WebView2, Microsoft Edge, and operating-system fonts are external runtime dependencies, governed by Microsoft's applicable terms. Tolcy does not bundle operating-system font files.
