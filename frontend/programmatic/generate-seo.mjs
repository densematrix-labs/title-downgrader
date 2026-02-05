#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'dimensions.json'), 'utf-8'));
const outputDir = join(__dirname, '../public/p');
const TOOL_URL = config.tool_url;

if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

function generatePages() {
  const pages = [], seen = new Set(), d = config.dimensions;
  const add = (slug, data) => { if (!seen.has(slug)) { seen.add(slug); pages.push({ slug, ...data }); } };
  
  // title × industry × level (1,920)
  for (const ti of d.original_title.values) {
    for (const ind of d.industry.values) {
      for (const lv of d.downgrade_level.values) {
        add(`${ti.id}-${ind.id}-${lv.id}`, { title: ti, industry: ind, level: lv });
      }
    }
  }
  // title × level × style (1,280)
  for (const ti of d.original_title.values) {
    for (const lv of d.downgrade_level.values) {
      for (const st of d.style.values) {
        add(`${ti.id}-${lv.id}-${st.id}`, { title: ti, level: lv, style: st });
      }
    }
  }
  // title × industry × style (1,920)
  for (const ti of d.original_title.values) {
    for (const ind of d.industry.values) {
      for (const st of d.style.values) {
        add(`${ti.id}-${ind.id}-${st.id}`, { title: ti, industry: ind, style: st });
      }
    }
  }
  // title × industry × level × style (15,360)
  for (const ti of d.original_title.values) {
    for (const ind of d.industry.values) {
      for (const lv of d.downgrade_level.values) {
        for (const st of d.style.values) {
          add(`${ti.id}-${ind.id}-${lv.id}-${st.id}`, { title: ti, industry: ind, level: lv, style: st });
        }
      }
    }
  }
  return pages;
}

function generateHTML(p) {
  const { slug, title, industry, level, style } = p;
  const url = `${TOOL_URL}/p/${slug}/`;
  const parts = [];
  if (level) parts.push(level.en);
  parts.push('Downgrade for');
  if (title) parts.push(title.en);
  if (industry) parts.push(`in ${industry.en}`);
  if (style) parts.push(`(${style.en})`);
  
  const h1 = parts.join(' ');
  const titleTag = `${h1} | Title Downgrader`;
  const desc = `Downgrade your ${title?.en || 'job title'} ${level?.en?.toLowerCase() || ''} style${industry ? ` in ${industry.en}` : ''}. AI reveals what your job title really means!`;
  
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titleTag}</title><meta name="description" content="${desc}"><link rel="canonical" href="${url}"><meta property="og:title" content="${titleTag}"><meta property="og:description" content="${desc}"><script async src="https://www.googletagmanager.com/gtag/js?id=G-P4ZLGKH1E1"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-P4ZLGKH1E1');</script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:24px;max-width:720px;margin:0 auto;min-height:100vh;line-height:1.6}h1{font-size:1.75rem;margin-bottom:1rem}p{margin-bottom:1rem;opacity:.9}.cta{background:#fff;color:#764ba2;padding:14px 28px;text-decoration:none;display:inline-block;margin:20px 0;border-radius:25px;font-weight:700}.cta:hover{transform:scale(1.05)}footer{margin-top:2rem;font-size:.8rem;opacity:.7}</style></head><body><h1>📉 ${h1}</h1><p>Think your ${title?.en || 'job title'} sounds impressive? Let our AI give you a reality check with a ${level?.en?.toLowerCase() || 'brutally honest'} downgrade.</p><a href="${TOOL_URL}?utm_source=seo" class="cta">Downgrade My Title →</a><footer>© 2024 DenseMatrix</footer></body></html>`;
}

function generateSitemaps(pages) {
  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const p of pages) xml += `<url><loc>${TOOL_URL}/p/${p.slug}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  xml += '</urlset>';
  writeFileSync(join(__dirname, '../public/sitemap-programmatic.xml'), xml);
  writeFileSync(join(__dirname, '../public/sitemap-main.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${TOOL_URL}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>`);
  writeFileSync(join(__dirname, '../public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${TOOL_URL}/sitemap-main.xml</loc></sitemap>\n<sitemap><loc>${TOOL_URL}/sitemap-programmatic.xml</loc></sitemap>\n</sitemapindex>`);
}

console.log('🚀 Generating pages...');
const pages = generatePages();
console.log(`📊 Total: ${pages.length}`);
let c = 0;
for (const p of pages) {
  const d = join(outputDir, p.slug);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'index.html'), generateHTML(p));
  if (++c % 3000 === 0) console.log(`  ${c}/${pages.length}...`);
}
generateSitemaps(pages);
console.log(`✅ Done! ${c} pages`);
