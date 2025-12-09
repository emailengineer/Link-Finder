/**
 * Example usage of the Link Finder API
 * Run this after starting the server with: npm start
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/crawl';

async function testCrawl() {
  try {
    console.log('Testing Link Finder API...\n');
    
    const testUrl = 'https://example.com';
    console.log(`Crawling: ${testUrl}\n`);
    
    const response = await axios.post(API_URL, {
      url: testUrl
    });
    
    console.log('Results:');
    console.log(`- Total Links Found: ${response.data.totalLinks}`);
    console.log(`- Crawl Duration: ${response.data.crawlDuration}`);
    console.log('\nLinks:');
    response.data.links.forEach((link, index) => {
      console.log(`${index + 1}. ${link}`);
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Uncomment to run
// testCrawl();

module.exports = { testCrawl };

