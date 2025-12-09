const puppeteer = require('puppeteer');
const axios = require('axios');
const robotsParser = require('robots-parser');
const { URL } = require('url');

class WebsiteCrawler {
  constructor(baseUrl, maxDepth = 2) {
    this.baseUrl = this.normalizeUrl(baseUrl);
    this.baseDomain = this.getDomain(this.baseUrl);
    this.maxDepth = maxDepth;
    this.visitedUrls = new Set();
    this.allLinks = new Set();
    this.robotsTxt = null;
    this.sitemapLinks = [];
    this.browser = null;
  }

  normalizeUrl(url) {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      const parsed = new URL(url);
      // Remove trailing slash for consistency
      return parsed.href.replace(/\/$/, '') || parsed.href;
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  getDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  isSameDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === this.baseDomain;
    } catch {
      return false;
    }
  }

  normalizeLink(href, baseUrl) {
    try {
      // Skip invalid link types
      if (!href || 
          href.trim() === '' || 
          href.startsWith('javascript:') || 
          href.startsWith('mailto:') || 
          href.startsWith('tel:') ||
          href.startsWith('data:') ||
          href.startsWith('#') ||
          href.trim() === '#') {
        return null;
      }

      // Use URL constructor to properly resolve relative URLs
      const base = new URL(baseUrl);
      let resolvedUrl;
      
      try {
        // This will automatically resolve relative URLs against the base URL
        resolvedUrl = new URL(href, base);
      } catch (error) {
        // If URL constructor fails, try manual resolution
        if (href.startsWith('//')) {
          resolvedUrl = new URL('https:' + href);
        } else if (href.startsWith('/')) {
          resolvedUrl = new URL(href, base.origin);
        } else {
          // Relative path
          resolvedUrl = new URL(href, base);
        }
      }

      // Remove fragments
      resolvedUrl.hash = '';
      
      // Remove trailing slash for consistency (except for root)
      let normalized = resolvedUrl.href;
      if (normalized.endsWith('/') && normalized !== resolvedUrl.origin + '/') {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized;
    } catch (error) {
      return null;
    }
  }

  async fetchRobotsTxt() {
    try {
      const robotsUrl = `${this.baseUrl.split('/').slice(0, 3).join('/')}/robots.txt`;
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      this.robotsTxt = robotsParser(robotsUrl, response.data);
      
      // Extract sitemap URLs from robots.txt
      const sitemapMatches = response.data.match(/Sitemap:\s*(.+)/gi);
      if (sitemapMatches) {
        for (const match of sitemapMatches) {
          const sitemapUrl = match.split(':')[1].trim();
          if (this.isValidUrl(sitemapUrl) && this.isSameDomain(sitemapUrl)) {
            this.sitemapLinks.push(sitemapUrl);
          }
        }
      }
    } catch (error) {
      console.log('Could not fetch robots.txt:', error.message);
    }
  }

  async parseSitemap(sitemapUrl) {
    try {
      const response = await axios.get(sitemapUrl, { timeout: 10000 });
      const content = response.data;
      
      // Parse XML sitemap
      const urlMatches = content.match(/<loc>(.*?)<\/loc>/gi);
      if (urlMatches) {
        for (const match of urlMatches) {
          const url = match.replace(/<\/?loc>/g, '').trim();
          if (this.isValidUrl(url) && this.isSameDomain(url)) {
            this.allLinks.add(url);
          }
        }
      }
    } catch (error) {
      console.log(`Could not parse sitemap ${sitemapUrl}:`, error.message);
    }
  }

  async crawlPage(url, depth = 0) {
    if (depth > this.maxDepth) {
      return;
    }

    const normalizedUrl = this.normalizeLink(url, this.baseUrl);
    if (!normalizedUrl || !this.isValidUrl(normalizedUrl) || !this.isSameDomain(normalizedUrl)) {
      return;
    }

    if (this.visitedUrls.has(normalizedUrl)) {
      return;
    }

    // Check robots.txt if available
    if (this.robotsTxt && !this.robotsTxt.isAllowed(normalizedUrl, 'LinkFinderBot')) {
      return;
    }

    this.visitedUrls.add(normalizedUrl);
    this.allLinks.add(normalizedUrl);

    try {
      console.log(`Crawling [Depth ${depth}]: ${normalizedUrl}`);

      // Reuse browser instance if available
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });
      }

      const page = await this.browser.newPage();
      
      // Set a reasonable timeout
      await page.setDefaultNavigationTimeout(30000);
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LinkFinderBot/1.0');

      try {
        const response = await page.goto(normalizedUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for any dynamic content to load
        await page.waitForTimeout(2000);
        
        // Wait for any lazy-loaded content
        try {
          await page.evaluate(() => {
            return new Promise((resolve) => {
              if (document.readyState === 'complete') {
                resolve();
              } else {
                window.addEventListener('load', resolve);
                setTimeout(resolve, 1000);
              }
            });
          });
        } catch (e) {
          // Ignore timeout errors
        }

        // Get the current page URL (after any redirects)
        const currentPageUrl = page.url();
        
        // Update normalizedUrl if there was a redirect
        if (currentPageUrl !== normalizedUrl) {
          const redirectedNormalized = this.normalizeLink(currentPageUrl, this.baseUrl);
          if (redirectedNormalized && this.isSameDomain(redirectedNormalized)) {
            normalizedUrl = redirectedNormalized;
            this.allLinks.add(normalizedUrl);
          }
        }

        // Extract all links using browser's native URL resolution
        const links = await page.evaluate((baseUrl) => {
          const links = new Set();
          const base = new URL(baseUrl);
          
          // Helper function to resolve and add link
          const addLink = (href) => {
            if (!href || typeof href !== 'string') return;
            
            href = href.trim();
            
            // Skip invalid link types
            if (href === '' || 
                href.startsWith('javascript:') || 
                href.startsWith('mailto:') || 
                href.startsWith('tel:') ||
                href.startsWith('data:') ||
                href === '#' ||
                (href.startsWith('#') && href.length === 1)) {
              return;
            }
            
            try {
              // Use browser's URL API to resolve relative URLs
              const resolvedUrl = new URL(href, base);
              // Remove fragments
              resolvedUrl.hash = '';
              // Get full URL string
              let fullUrl = resolvedUrl.href;
              // Remove trailing slash (except root)
              if (fullUrl.endsWith('/') && fullUrl !== resolvedUrl.origin + '/') {
                fullUrl = fullUrl.slice(0, -1);
              }
              links.add(fullUrl);
            } catch (error) {
              // Skip invalid URLs
              console.log('Invalid URL:', href);
            }
          };
          
          // Standard anchor tags
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          anchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href) {
              addLink(href);
            }
          });

          // Data attributes
          const elementsWithLinks = Array.from(document.querySelectorAll('[data-href], [data-url], [data-link], [data-path]'));
          elementsWithLinks.forEach(el => {
            const href = el.getAttribute('data-href') || 
                        el.getAttribute('data-url') || 
                        el.getAttribute('data-link') ||
                        el.getAttribute('data-path');
            if (href) {
              addLink(href);
            }
          });

          // Form actions
          const forms = Array.from(document.querySelectorAll('form[action]'));
          forms.forEach(form => {
            const action = form.getAttribute('action');
            if (action) {
              addLink(action);
            }
          });

          // Link tags (canonical, alternate, etc. - but skip stylesheets)
          const linkTags = Array.from(document.querySelectorAll('link[href]'));
          linkTags.forEach(link => {
            const rel = link.getAttribute('rel');
            // Only include links that are likely to be page URLs
            if (rel && (rel.includes('canonical') || rel.includes('alternate') || rel.includes('next') || rel.includes('prev'))) {
              const href = link.getAttribute('href');
              if (href) {
                addLink(href);
              }
            }
          });

          // Meta refresh redirects
          const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
          if (metaRefresh && metaRefresh.content) {
            const match = metaRefresh.content.match(/url=(.+)/i);
            if (match && match[1]) {
              addLink(match[1].trim());
            }
          }

          // Area tags (image maps)
          const areas = Array.from(document.querySelectorAll('area[href]'));
          areas.forEach(area => {
            const href = area.getAttribute('href');
            if (href) {
              addLink(href);
            }
          });

          // Iframe src attributes
          const iframes = Array.from(document.querySelectorAll('iframe[src]'));
          iframes.forEach(iframe => {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('javascript:') && !src.startsWith('data:')) {
              addLink(src);
            }
          });

          // Also check for base tag
          const baseTag = document.querySelector('base[href]');
          if (baseTag) {
            const baseHref = baseTag.getAttribute('href');
            if (baseHref) {
              addLink(baseHref);
            }
          }

          return Array.from(links);
        }, currentPageUrl);
        
        console.log(`Found ${links.length} links on ${normalizedUrl}`);

        // Process found links (they should already be fully qualified URLs from page.evaluate)
        for (const link of links) {
          // Double-check normalization (links should already be absolute from browser)
          const normalizedLink = this.normalizeLink(link, normalizedUrl) || link;
          
          if (normalizedLink && this.isValidUrl(normalizedLink) && this.isSameDomain(normalizedLink)) {
            // Ensure it's a full URL with domain
            try {
              const urlObj = new URL(normalizedLink);
              // Only add http/https URLs
              if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                this.allLinks.add(normalizedLink);
                
                // Crawl deeper if within depth limit
                if (depth < this.maxDepth) {
                  await this.crawlPage(normalizedLink, depth + 1);
                }
              }
            } catch (error) {
              // Skip invalid URLs
              console.log(`Skipping invalid URL: ${normalizedLink}`);
            }
          }
        }

      } catch (error) {
        console.log(`Error loading page ${normalizedUrl}:`, error.message);
      } finally {
        await page.close();
      }

    } catch (error) {
      console.log(`Error crawling ${normalizedUrl}:`, error.message);
    }
  }

  async crawl() {
    console.log(`Starting crawl of ${this.baseUrl} (max depth: ${this.maxDepth})`);

    // Step 1: Fetch robots.txt and extract sitemaps
    await this.fetchRobotsTxt();

    // Step 2: Parse sitemaps if found
    for (const sitemapUrl of this.sitemapLinks) {
      await this.parseSitemap(sitemapUrl);
    }

    // Step 3: Crawl the website starting from base URL
    await this.crawlPage(this.baseUrl, 0);

    // Close browser if it was opened
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    // Return sorted array of unique links
    return Array.from(this.allLinks).sort();
  }
}

async function crawlWebsite(url) {
  const crawler = new WebsiteCrawler(url, 2);
  return await crawler.crawl();
}

module.exports = { crawlWebsite, WebsiteCrawler };

