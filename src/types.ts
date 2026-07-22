export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  content?: string; 
}

export interface SearchResponse {
  searchParameters: {
    query: string;
    search_service: string;
    max_results: number;
    [key: string]: any;  
  };
  results: SearchResult[];
}

export enum SearchService {
  GOOGLE = "google",
  BING = "bing",
  DUCKDUCKGO = "duckduckgo",
  YAHOO = "yahoo",
  GITHUB = "github",
  YOUTUBE = "youtube",
  X = "x",
  REDDIT = "reddit",
  ARXIV = "arxiv",
  WECHAT = "wechat",
  BILIBILI = "bilibili",
  IMDB = "imdb",
  WIKIPEDIA = "wikipedia",
}

export enum NewsService {
  GOOGLE = "google",
  BING = "bing",
  DUCKDUCKGO = "duckduckgo",
  YAHOO = "yahoo",
  HACKERNEWS = "hackernews"
}

export enum TimeRange {
  DAY = "day",
  MONTH = "month",
  YEAR = "year"
}

export interface SearchArgs {
  query: string;
  max_results?: number;
  search_service?: SearchService;
  crawl_results?: number;
  include_sites?: string[];
  exclude_sites?: string[];
  time_range?: TimeRange;
}

export function isValidSearchArgs(args: unknown): args is SearchArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { 
    query, 
    max_results, 
    search_service, 
    crawl_results, 
    include_sites, 
    exclude_sites, 
    time_range 
  } = args as SearchArgs;

  if (typeof query !== 'string' || query.trim().length === 0) {
    return false;
  }

  if (max_results !== undefined && (typeof max_results !== 'number' || max_results < 1 || max_results > 50)) {
    return false;
  }

  if (search_service !== undefined) {
    const validServices = Object.values(SearchService);
    if (!validServices.includes(search_service)) {
      return false;
    }
  }
  
  if (crawl_results !== undefined && (typeof crawl_results !== 'number' || crawl_results < 0)) {
    return false;
  }
  
  if (include_sites !== undefined && (!Array.isArray(include_sites) || !include_sites.every(site => typeof site === 'string'))) {
    return false;
  }
  
  if (exclude_sites !== undefined && (!Array.isArray(exclude_sites) || !exclude_sites.every(site => typeof site === 'string'))) {
    return false;
  }
  
  if (time_range !== undefined) {
    const validTimeRanges = Object.values(TimeRange);
    if (!validTimeRanges.includes(time_range)) {
      return false;
    }
  }

  return true;
}

export interface CrawlResult {
  title: string;
  link: string;
  content: string;
}

export interface CrawlResponse {
  crawlParameters: {
    url: string;
  };
  results: CrawlResult;
}

export interface CrawlArgs {
  url: string;
}

export function isValidCrawlArgs(args: unknown): args is CrawlArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { url } = args as CrawlArgs;

  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  return true;
}

export interface SitemapResponse {
  links: string[];
}

export interface SitemapArgs {
  url: string;
}

export function isValidSitemapArgs(args: unknown): args is SitemapArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { url } = args as SitemapArgs;

  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  return true;
}

export interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  content?: string; 
}

export interface NewsResponse {
  searchParameters: {
    query: string;
    search_service: string;
    max_results: number;
    [key: string]: any; 
  };
  results: NewsResult[];
}

export interface NewsArgs {
  query: string;
  max_results?: number;
  search_service?: NewsService;
  crawl_results?: number;
  include_sites?: string[];
  exclude_sites?: string[];
  time_range?: TimeRange;
}

export function isValidNewsArgs(args: unknown): args is NewsArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { 
    query, 
    max_results, 
    search_service, 
    crawl_results,
    include_sites,
    exclude_sites,
    time_range
  } = args as NewsArgs;

  if (typeof query !== 'string' || query.trim().length === 0) {
    return false;
  }

  if (max_results !== undefined && (typeof max_results !== 'number' || max_results < 1 || max_results > 50)) {
    return false;
  }

  if (search_service !== undefined) {
    const validServices = Object.values(NewsService);
    if (!validServices.includes(search_service)) {
      return false;
    }
  }

  if (crawl_results !== undefined && (typeof crawl_results !== 'number' || crawl_results < 0)) {
    return false;
  }

  if (include_sites !== undefined && (!Array.isArray(include_sites) || !include_sites.every(site => typeof site === 'string'))) {
    return false;
  }

  if (exclude_sites !== undefined && (!Array.isArray(exclude_sites) || !exclude_sites.every(site => typeof site === 'string'))) {
    return false;
  }

  if (time_range !== undefined) {
    const validTimeRanges = Object.values(TimeRange);
    if (!validTimeRanges.includes(time_range)) {
      return false;
    }
  }

  return true;
}

export enum TrendingService {
  GITHUB = "github",
  HACKERNEWS = "hackernews"
}

export interface TrendingResult {
  title: string;
  url: string;
  description?: string;
}

export interface TrendingResponse {
  trendingParameters: {
    search_service: string;
    max_results: number;
    [key: string]: any;
  };
  results: TrendingResult[];
}

export interface TrendingArgs {
  search_service: TrendingService;
  max_results?: number;
}

export function isValidTrendingArgs(args: unknown): args is TrendingArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { search_service, max_results } = args as TrendingArgs;

  if (search_service === undefined) {
    return false;
  }

  const validServices = Object.values(TrendingService);
  if (!validServices.includes(search_service)) {
    return false;
  }

  if (max_results !== undefined && (typeof max_results !== 'number' || max_results < 1 || max_results > 50)) {
    return false;
  }

  return true;
}
