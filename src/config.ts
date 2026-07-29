import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { log } from './utils.js';

// Check API key directly from environment variables first
let API_KEY = process.env.SEARCH1API_KEY;
log(`Attempting to read SEARCH1API_KEY from environment: ${API_KEY ? 'Found' : 'Not found'}`);

// If not found in env, try loading from .env file in project root as fallback
if (!API_KEY) {
  log('SEARCH1API_KEY not found in environment, attempting to load from .env file in project root...');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Path relative to the build directory (build/config.js) to reach project root
  const projectRootEnvPath = join(__dirname, '../.env'); 
  
  log(`Attempting to load .env from: ${projectRootEnvPath}`);
  const result = dotenv.config({ path: projectRootEnvPath });

  if (result.error) {
    log(`Failed to load .env from ${projectRootEnvPath}: ${result.error.message}`);
  } else if (result.parsed && result.parsed.SEARCH1API_KEY) {
    API_KEY = result.parsed.SEARCH1API_KEY;
    log(`Successfully loaded SEARCH1API_KEY from ${projectRootEnvPath}`);
  } else {
    log(`.env file found at ${projectRootEnvPath}, but SEARCH1API_KEY was not inside.`);
  }
}

// Final check
if (!API_KEY) {
  log('SEARCH1API_KEY not found. Stdio mode requires it; HTTP mode uses per-request credentials.');
} else {
  log('API key located successfully.');
}

// API configuration
export const API_CONFIG = {
  BASE_URL: 'https://api.search1api.com',
  DEFAULT_QUERY: 'latest news in the world',
  ENDPOINTS: {
    SEARCH: '/search',
    CRAWL: '/crawl',
    SITEMAP: '/sitemap',
    NEWS: '/news',
    TRENDING: '/trending'
  }
} as const;

// Export API key
export { API_KEY };
