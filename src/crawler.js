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
      // Handle relative URLs
      if (href.startsWith('//')) {
        href = 'https:' + href;
      } else if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        href = base.origin + href;
      } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
        const base = new URL(baseUrl);
        href = new URL(href, base).href;
      }

      const url = new URL(href);
      
      // Remove fragments
      url.hash = '';
      
      // Remove trailing slash for consistency
      let normalized = url.href.replace(/\/$/, '');
      
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
        await page.goto(normalizedUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for any dynamic content
        await page.waitForTimeout(2000);

        // Extract all links
        const links = await page.evaluate(() => {
          const links = new Set();
          
          // Standard anchor tags
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          anchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href && href.trim()) {
              links.add(href.trim());
            }
          });

          // Data attributes
          const elementsWithLinks = Array.from(document.querySelectorAll('[data-href], [data-url], [data-link], [data-path]'));
          elementsWithLinks.forEach(el => {
            const href = el.getAttribute('data-href') || 
                        el.getAttribute('data-url') || 
                        el.getAttribute('data-link') ||
                        el.getAttribute('data-path');
            if (href && href.trim()) {
              links.add(href.trim());
            }
          });

          // Form actions
          const forms = Array.from(document.querySelectorAll('form[action]'));
          forms.forEach(form => {
            const action = form.getAttribute('action');
            if (action && action.trim()) {
              links.add(action.trim());
            }
          });

          // Link tags (CSS, canonical, etc.)
          const linkTags = Array.from(document.querySelectorAll('link[href]'));
          linkTags.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.trim()) {
              links.add(href.trim());
            }
          });

          // Meta refresh redirects
          const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
          if (metaRefresh && metaRefresh.content) {
            const match = metaRefresh.content.match(/url=(.+)/i);
            if (match && match[1]) {
              links.add(match[1].trim());
            }
          }

          return Array.from(links);
        });

        // Process found links
        for (const link of links) {
          const normalizedLink = this.normalizeLink(link, normalizedUrl);
          if (normalizedLink && this.isValidUrl(normalizedLink) && this.isSameDomain(normalizedLink)) {
            this.allLinks.add(normalizedLink);
            
            // Crawl deeper if within depth limit
            if (depth < this.maxDepth) {
              await this.crawlPage(normalizedLink, depth + 1);
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

