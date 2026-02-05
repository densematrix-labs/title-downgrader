#!/usr/bin/env npx ts-node
/**
 * Programmatic SEO Page Generator for AI Title Downgrader
 */

import * as fs from 'fs';
import * as path from 'path';

interface Dimension {
  name: string;
  name_zh: string;
  values_en: string[];
  values_zh: string[];
}

interface DimensionsConfig {
  tool: string;
  tool_url: string;
  dimensions: Dimension[];
  combinations: string[][];
}

const config: DimensionsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dimensions.json'), 'utf-8')
);

const outputDir = path.join(__dirname, '../public/p');
const sitemapPath = path.join(__dirname, '../public/sitemap-programmatic.xml');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function titleCase(text: string): string {
  return text.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function generatePage(dim1: string, val1: string, dim2: string, val2: string): string {
  const title = `${titleCase(val1)} ${titleCase(val2)} Title Downgrader`;
  const description = `Remove ${titleCase(val2).toLowerCase()} from ${titleCase(val1).toLowerCase()} headlines. Our AI transforms sensational titles into honest, straightforward ones. Free to use!`;
  const slug = `${slugify(val1)}-${slugify(val2)}`;
  const url = `${config.tool_url}/p/${slug}/`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | AI Tool</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="DenseMatrix">
  
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${title}",
    "description": "${description}",
    "url": "${url}",
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "author": { "@type": "Organization", "name": "DenseMatrix", "url": "https://densematrix.ai" }
  }
  </script>
  
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #1a1a2e; }
    .cta { background: #e63946; color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; display: inline-block; margin: 2rem 0; }
    .cta:hover { background: #c1121f; }
    .related { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #eee; }
    .related a { display: block; margin: 0.5rem 0; color: #e63946; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  
  <p>Tired of ${titleCase(val2).toLowerCase()} in ${titleCase(val1).toLowerCase()} content? Our AI Title Downgrader transforms sensational headlines into honest, straightforward ones.</p>
  
  <h2>Why Downgrade ${titleCase(val1)} Titles?</h2>
  <p>${titleCase(val1)} content is often plagued by ${titleCase(val2).toLowerCase()} titles that overpromise and underdeliver. Our tool helps you:</p>
  <ul>
    <li>Cut through the hype and see what content is really about</li>
    <li>Make more informed decisions about what to read</li>
    <li>Improve your media literacy</li>
    <li>Share more honest headlines with others</li>
  </ul>
  
  <a href="${config.tool_url}?ref=p&${dim1}=${val1}&${dim2}=${val2}" class="cta">Downgrade a Title Now →</a>
  
  <div class="related">
    <h3>Related Tools</h3>
  </div>
</body>
</html>`;
}

const pages: { slug: string; url: string }[] = [];

for (const [dim1Name, dim2Name] of config.combinations) {
  const dim1 = config.dimensions.find(d => d.name === dim1Name);
  const dim2 = config.dimensions.find(d => d.name === dim2Name);
  
  if (!dim1 || !dim2) continue;
  
  for (const val1 of dim1.values_en) {
    for (const val2 of dim2.values_en) {
      const slug = `${slugify(val1)}-${slugify(val2)}`;
      const pageDir = path.join(outputDir, slug);
      
      if (!fs.existsSync(pageDir)) {
        fs.mkdirSync(pageDir, { recursive: true });
      }
      
      const html = generatePage(dim1Name, val1, dim2Name, val2);
      fs.writeFileSync(path.join(pageDir, 'index.html'), html);
      
      pages.push({
        slug,
        url: `${config.tool_url}/p/${slug}/`
      });
    }
  }
}

const today = new Date().toISOString().split('T')[0];
const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(sitemapPath, sitemapContent);

console.log(`✅ Generated ${pages.length} programmatic SEO pages`);
console.log(`✅ Sitemap written to ${sitemapPath}`);
