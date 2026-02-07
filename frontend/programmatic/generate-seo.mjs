#!/usr/bin/env node
/**
 * Programmatic SEO Page Generator for Title Downgrader
 * 
 * 🔴 Quality Standards (2026-02-07):
 * - Each page MUST have >= 500 characters of content
 * - Each page MUST have unique title, description, and body
 * - Each page MUST have internal links to related pages
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'dimensions.json'), 'utf-8'));
const outputDir = join(__dirname, '../public/p');
const TOOL_URL = config.tool_url;

if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

// Content generation helpers
const titleContexts = {
  'ceo': { 
    reality: 'sending emails, attending meetings, and pretending to understand what your engineers do',
    joke: 'Chief Everything Overwhelming - you delegate the actual work while taking credit for "vision"',
    truth: 'a glorified meeting scheduler who occasionally makes decisions'
  },
  'cto': {
    reality: 'debugging legacy code at 2am while explaining to the CEO why the app is down',
    joke: 'Chief Technology Overthinker - you draw architecture diagrams no one follows',
    truth: 'a senior developer who got promoted because you stayed the longest'
  },
  'cfo': {
    reality: 'saying "no" to every budget request and making scary spreadsheets',
    joke: 'Chief Finances Obscurer - you make money problems sound like solutions',
    truth: 'someone who turned "we can\'t afford that" into a career'
  },
  'vp': {
    reality: 'scheduling one-on-ones and forwarding emails with "thoughts?" attached',
    joke: 'Very Perplexed - you\'re not sure what you do either',
    truth: 'a middle manager with a fancier title and more meetings'
  },
  'director': {
    reality: 'making PowerPoint decks about quarterly goals no one remembers',
    joke: 'Director of Directing Directions - you point at things and call it leadership',
    truth: 'the person who says "let\'s take this offline" in every meeting'
  },
  'senior-engineer': {
    reality: 'reviewing PRs, mentoring juniors, and explaining why we can\'t just rewrite everything in Rust',
    joke: 'Senior Stack Overflow Navigator - you Google things professionally',
    truth: 'a developer who has strong opinions about tabs vs spaces'
  },
  'manager': {
    reality: 'approving PTO requests and scheduling recurring meetings about other meetings',
    joke: 'Professional Meeting Attendee - you manage calendars, not people',
    truth: 'someone who got promoted because they were "easy to work with"'
  },
  'founder': {
    reality: 'cold-emailing investors, crying in the shower, and calling it "the grind"',
    joke: 'Professional Pitch Deck Artist - you raised money to burn money',
    truth: 'unemployed but with a LLC and too much optimism'
  },
  'consultant': {
    reality: 'repackaging common sense into $500/hour advice',
    joke: 'Professional Question Asker - you bill hourly for asking "why?"',
    truth: 'someone who couldn\'t get a real job so they made one up'
  },
  'professor': {
    reality: 'reading papers nobody will cite while avoiding students',
    joke: 'Professional Knowledge Hoarder - you publish or perish (mostly perish)',
    truth: 'a perpetual student who refuses to leave campus'
  }
};

const industryInsights = {
  'tech': 'where everyone has "Senior" or "Lead" in their title but nobody knows who\'s in charge',
  'finance': 'where titles are inversely proportional to actual financial knowledge',
  'consulting': 'where everyone is a "Partner" or "Director" of something vague',
  'healthcare': 'where you need 17 certifications to be called anything at all',
  'startup': 'where everyone is a "Co-Founder" of a company with 3 employees',
  'faang': 'where a "Staff Engineer" makes more than most CEOs',
  'government': 'where titles have Roman numerals and nobody knows what they mean',
  'academia': 'where "Professor" can mean anything from Nobel laureate to adjunct purgatory'
};

const levelDescriptions = {
  'mild': 'a gentle reality check that won\'t hurt too much',
  'moderate': 'enough truth to make you uncomfortable at the next networking event',
  'savage': 'brutally honest in a way your friends are too nice to be',
  'brutal': 'the kind of feedback you didn\'t ask for but definitely needed',
  'existential': 'questioning not just your title, but your entire career trajectory',
  'realistic': 'what your job description would say if HR was honest',
  'linkedin': 'if LinkedIn bios told the actual truth',
  'resume': 'what your resume would look like without the buzzwords'
};

function generatePages() {
  const pages = [], seen = new Set(), d = config.dimensions;
  const add = (slug, data) => { if (!seen.has(slug)) { seen.add(slug); pages.push({ slug, ...data }); } };
  
  // Combination 1: title × industry × level (1,920)
  for (const ti of d.original_title.values) {
    for (const ind of d.industry.values) {
      for (const lv of d.downgrade_level.values) {
        add(`${ti.id}-${ind.id}-${lv.id}`, { title: ti, industry: ind, level: lv });
      }
    }
  }
  // Combination 2: title × level × style (1,280)
  for (const ti of d.original_title.values) {
    for (const lv of d.downgrade_level.values) {
      for (const st of d.style.values) {
        add(`${ti.id}-${lv.id}-${st.id}`, { title: ti, level: lv, style: st });
      }
    }
  }
  // Combination 3: title × industry × style (1,920)
  for (const ti of d.original_title.values) {
    for (const ind of d.industry.values) {
      for (const st of d.style.values) {
        add(`${ti.id}-${ind.id}-${st.id}`, { title: ti, industry: ind, style: st });
      }
    }
  }
  // Combination 4: title × industry × level × style (15,360)
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

function getRelatedPages(page, allPages) {
  const { title, industry, level, style } = page;
  const related = [];
  
  // Same title, different industry
  if (industry) {
    const sameTitle = allPages.filter(p => 
      p.title?.id === title?.id && 
      p.industry?.id !== industry?.id
    ).slice(0, 2);
    related.push(...sameTitle);
  }
  
  // Same industry, different title
  if (title && industry) {
    const sameIndustry = allPages.filter(p => 
      p.industry?.id === industry?.id && 
      p.title?.id !== title?.id
    ).slice(0, 2);
    related.push(...sameIndustry);
  }
  
  // Same level, different combination
  if (level) {
    const sameLevel = allPages.filter(p => 
      p.level?.id === level?.id && 
      p.slug !== page.slug
    ).slice(0, 2);
    related.push(...sameLevel);
  }
  
  return related.slice(0, 5);
}

function generateHTML(page, allPages) {
  const { slug, title, industry, level, style } = page;
  const url = `${TOOL_URL}/p/${slug}/`;
  
  // Build title parts
  const parts = [];
  if (level) parts.push(level.en);
  parts.push('Downgrade for');
  if (title) parts.push(title.en);
  if (industry) parts.push(`in ${industry.en}`);
  if (style) parts.push(`(${style.en})`);
  
  const h1 = parts.join(' ');
  const titleTag = `${h1} | Title Downgrader`;
  const titleLower = title?.en?.toLowerCase() || 'professional';
  const levelLower = level?.en?.toLowerCase() || 'brutally honest';
  const industryLower = industry?.en?.toLowerCase() || 'corporate';
  
  // Get contextual content
  const titleCtx = titleContexts[title?.id] || titleContexts['manager'];
  const industryCtx = industryInsights[industry?.id] || industryInsights['tech'];
  const levelDesc = levelDescriptions[level?.id] || levelDescriptions['savage'];
  
  const desc = `Get a ${levelLower} reality check for your ${titleLower} title${industry ? ` in ${industryLower}` : ''}. AI reveals what your impressive job title really means. Free & instant!`;
  
  // Generate related links
  const related = getRelatedPages(page, allPages);
  const relatedHtml = related.map(r => 
    `<a href="${TOOL_URL}/p/${r.slug}/">${r.title?.en || 'Title'} ${r.level?.en || ''} ${r.industry ? `in ${r.industry.en}` : ''}</a>`
  ).join('\n        ');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleTag}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${titleTag}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebApplication","name":"${h1}","description":"${desc}","url":"${url}","applicationCategory":"EntertainmentApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"author":{"@type":"Organization","name":"DenseMatrix","url":"https://densematrix.ai"}}
  </script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-P4ZLGKH1E1"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-P4ZLGKH1E1');</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 24px; max-width: 800px; margin: 0 auto; min-height: 100vh; line-height: 1.7; }
    h1 { font-size: 1.75rem; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; opacity: 0.9; }
    p { margin-bottom: 1rem; opacity: 0.95; }
    .cta { background: #fff; color: #764ba2; padding: 14px 28px; text-decoration: none; display: inline-block; margin: 20px 0; border-radius: 25px; font-weight: 700; }
    .cta:hover { transform: scale(1.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
    .section { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin: 20px 0; }
    .faq dt { font-weight: bold; margin-top: 1rem; }
    .faq dd { margin-left: 0; opacity: 0.9; }
    .related { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); }
    .related a { display: inline-block; margin: 4px 8px 4px 0; color: #fff; text-decoration: none; opacity: 0.8; }
    .related a:hover { opacity: 1; text-decoration: underline; }
    footer { margin-top: 2rem; font-size: 0.85rem; opacity: 0.7; }
    footer a { color: #fff; }
  </style>
</head>
<body>
  <h1>📉 ${h1}</h1>
  
  <p>Think your <strong>${titleLower}</strong> title sounds impressive? Our AI will give you ${levelDesc}. In the world of ${industryLower}, ${industryCtx}.</p>
  
  <div class="section">
    <h2>🎯 What Is Title Downgrading?</h2>
    <p>Title Downgrader takes your fancy ${titleLower} title and translates it into what you actually do. As a ${title?.en || 'professional'}, you're probably ${titleCtx.reality}. Let's be honest: ${titleCtx.truth}.</p>
  </div>
  
  <div class="section">
    <h2>😈 The ${level?.en || 'Brutal'} Truth</h2>
    <p>Here's the thing about being a ${titleLower}${industry ? ` in ${industryLower}` : ''}: ${titleCtx.joke}. But don't worry—everyone's title is inflated. That's just how ${industryLower} works.</p>
  </div>
  
  <a href="${TOOL_URL}?utm_source=seo&title=${title?.id || ''}&industry=${industry?.id || ''}" class="cta">Downgrade My Title Now →</a>
  
  <div class="section faq">
    <h2>❓ FAQ</h2>
    <dl>
      <dt>Is this serious?</dt>
      <dd>It's satire! We're poking fun at corporate title inflation. Your ${titleLower} title is probably well-earned (or at least well-negotiated).</dd>
      
      <dt>Why ${levelLower}?</dt>
      <dd>Sometimes you need ${levelDesc}. It's healthy to laugh at ourselves—especially in ${industryLower}.</dd>
      
      <dt>Can I share my downgrade?</dt>
      <dd>Absolutely! Share it on LinkedIn for maximum irony. Your recruiter connections will love it.</dd>
    </dl>
  </div>
  
  <div class="related">
    <h2>🔗 Related Downgrades</h2>
    ${relatedHtml || '<a href="' + TOOL_URL + '">Try another title →</a>'}
  </div>
  
  <footer>
    <p>© 2024 <a href="https://densematrix.ai">DenseMatrix</a> | <a href="${TOOL_URL}">Title Downgrader</a> | All titles are equally meaningless 💼</p>
  </footer>
</body>
</html>`;
}

function generateSitemaps(pages) {
  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const p of pages) {
    xml += `<url><loc>${TOOL_URL}/p/${p.slug}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  }
  xml += '</urlset>';
  writeFileSync(join(__dirname, '../public/sitemap-programmatic.xml'), xml);
  
  writeFileSync(join(__dirname, '../public/sitemap-main.xml'), 
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${TOOL_URL}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>`
  );
  
  writeFileSync(join(__dirname, '../public/sitemap.xml'), 
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>${TOOL_URL}/sitemap-main.xml</loc></sitemap>\n<sitemap><loc>${TOOL_URL}/sitemap-programmatic.xml</loc></sitemap>\n</sitemapindex>`
  );
}

// Main
console.log('🚀 Generating programmatic SEO pages for Title Downgrader...');
const pages = generatePages();
console.log(`📊 Total pages: ${pages.length}`);

let count = 0;
for (const page of pages) {
  const pageDir = join(outputDir, page.slug);
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(join(pageDir, 'index.html'), generateHTML(page, pages));
  if (++count % 3000 === 0) console.log(`  ${count}/${pages.length}...`);
}

generateSitemaps(pages);
console.log(`✅ Done! ${count} pages generated with enriched content`);
