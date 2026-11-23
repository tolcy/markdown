// Prepare redistribution notices for the frontend and the locked Windows Rust graph.
// Run cargo metadata --manifest-path src-tauri/Cargo.toml --locked --offline
// --format-version 1 --filter-platform x86_64-pc-windows-msvc first and save it
// to .tools/cargo-metadata.json. No source or user files are uploaded.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'licenses');
fs.mkdirSync(destination, { recursive: true });

async function get(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`${response.status} ${url}`);
      return response;
    } catch (error) { if (attempt === 2) throw error; }
  }
}

function licenseMembers(compressed) {
  const tar = zlib.gunzipSync(compressed), result = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    const kind = String.fromCharCode(header[156]);
    if ((kind === '0' || kind === '\0') && /(?:^|\/)(?:[^/]*\.)?(?:licen[sc]e|notice|copying|copyright|ofl)(?:[./_-]|$)/i.test(name) && size < 500000) {
      result.push({ name, text: tar.subarray(offset + 512, offset + 512 + size).toString('utf8') });
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return result;
}

// Versions visible in bundled headers are used where available. The remaining
// references identify license texts, not a claim to a complete dependency SBOM.
const frontend = [
  ['vditor','3.11.2'], ['diff-match-patch','1.0.5'], ['abcjs','5.10.3'],
  ['echarts','5.5.1'], ['zrender','5.6.0'], ['flowchart.js','1.18.0'],
  ['raphael','2.3.0'], ['eve-raphael','0.5.0'], ['viz.js','2.1.2'],
  ['highlight.js','11.7.0'], ['katex','0.16.9'], ['mathjax','3.2.2'],
  ['mermaid','11.6.0'], ['dompurify','3.2.4'], ['js-yaml','4.1.0'],
  ['lodash-es','4.17.21'], ['cytoscape','3.31.0'], ['markmap-view','0.16.0'],
  ['markmap-lib','0.16.0'], ['d3','6.7.0'], ['d3-flextree','2.1.2'],
  ['prismjs','1.29.0'], ['plantuml-encoder','1.4.0'], ['pako','1.0.11'],
  ['smiles-drawer','2.0.1'],
];

async function main() {
  const rows = [];
  const previousPath = path.join(destination, 'frontend-index.json');
  const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : [];
  let next = 0;
  await Promise.all(Array.from({length: 5}, async () => {
    while (next < frontend.length) {
      const [name, version] = frontend[next++];
      const cache = path.join(destination, 'frontend', name.replace(/\//g, '_'));
      fs.mkdirSync(cache, { recursive: true });
      const cached = previous.find(row => row.name === name && row.referenceVersion === version);
      if (cached && fs.readdirSync(cache).length) { rows.push(cached); continue; }
      const metadata = await (await get(`https://registry.npmjs.org/${name}/${version}`)).json();
      const members = licenseMembers(Buffer.from(await (await get(metadata.dist.tarball)).arrayBuffer()));
      if (!members.length) throw Error(`No license text found for ${name}@${version}`);
      for (const member of members) {
        const safe = member.name.replace(/^package\//, '').replace(/[\\/:*?"<>|]/g, '_');
        fs.writeFileSync(path.join(cache, safe), member.text);
      }
      rows.push({name,referenceVersion:version,license:metadata.license,source:metadata.dist.tarball,files:members.map(m=>m.name)});
      console.log(`Collected ${name}: ${members.length} license/notice files`);
    }
  }));

  const references = [
    ['Lute-1.7.6-LICENSE.txt','https://raw.githubusercontent.com/88250/lute/v1.7.6/LICENSE'],
    ['EPL-1.0.txt','https://raw.githubusercontent.com/spdx/license-list-data/main/text/EPL-1.0.txt'],
    ['Graphviz-2.40.1-notices.txt','https://raw.githubusercontent.com/mdaines/viz.js/v2.1.2/LICENSE'],
  ];
  for(const [name,url] of references) {
    const file = path.join(destination,name);
    if (!fs.existsSync(file)) fs.writeFileSync(file,await(await get(url)).text());
  }
  const graphvizHeader = fs.readFileSync(path.join(root,'node_modules/vditor/dist/js/graphviz/viz.js'),'utf8').split('*/')[0]+'*/\n';
  fs.writeFileSync(path.join(destination,'Graphviz-viz.js-distribution-header.txt'),graphvizHeader);
  fs.writeFileSync(path.join(destination,'frontend-index.json'),JSON.stringify(rows.sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');

  const metadata = JSON.parse(fs.readFileSync(path.join(root,'.tools/cargo-metadata.json'),'utf8').replace(/^\uFEFF/,''));
  const crates = [];
  for(const pkg of metadata.packages.filter(p=>p.source)) {
    const dir=path.dirname(pkg.manifest_path);
    const texts=[];
    const names=new Set(fs.readdirSync(dir).filter(name=>/^(license|copying|notice|copyright)([._-]|$)/i.test(name)));
    if(pkg.license_file)names.add(pkg.license_file);
    for(const name of names){const file=path.resolve(dir,name);if(fs.existsSync(file)&&fs.statSync(file).isFile())texts.push(`--- ${name} ---\n${fs.readFileSync(file,'utf8')}`);}
    const supplement=path.join(destination,'rust',`${pkg.name}-${pkg.version}-upstream-license.txt`);
    if (fs.existsSync(supplement)) texts.push(fs.readFileSync(supplement,'utf8'));
    const file=path.join(destination,'rust',`${pkg.name}-${pkg.version}.txt`);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const source=pkg.repository||`https://crates.io/crates/${pkg.name}/${pkg.version}`;
    fs.writeFileSync(file,`${pkg.name} ${pkg.version}\nDeclared license: ${pkg.license}\nSource: ${source}\n\n${texts.join('\n\n')}\n`);
    crates.push({name:pkg.name,version:pkg.version,license:pkg.license,repository:source,licenseTextFiles:texts.length});
  }
  fs.writeFileSync(path.join(destination,'rust-index.json'),JSON.stringify(crates,null,2)+'\n');
  console.log(`Collected ${crates.length} Rust package records; missing text: ${crates.filter(p=>!p.licenseTextFiles).map(p=>p.name).join(', ') || 'none'}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
