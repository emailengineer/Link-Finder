const express = require('express');
const cors = require('cors');
const { crawlWebsite } = require('./crawler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/crawl', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'URL is required and must be a non-empty string' 
      });
    }

    const startTime = Date.now();
    const links = await crawlWebsite(url.trim());
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.json({
      success: true,
      url: url.trim(),
      totalLinks: links.length,
      crawlDuration: `${duration}s`,
      links: links
    });
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to crawl website', 
      message: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

