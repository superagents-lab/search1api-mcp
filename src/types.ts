export interface SearchResultMetadata {
  /** GitHub: result type, repository stars/language, or thread comments. */
  kind?: "repo" | "issue" | "pr" | "discussion";
  stars?: number;
  language?: string;
  /** GitHub threads and Hacker News news results. */
  num_comments?: number;
  /** Hacker News: votes and submitted article URL; link is the discussion. */
  points?: number;
  story_url?: string;
  [key: string]: unknown;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  content?: string;
  published_date?: string;
  metadata?: SearchResultMetadata;
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
  BINGCN = "bingcn",
  DUCKDUCKGO = "duckduckgo",
  YAHOO = "yahoo",
  YANDEX = "yandex",
  GITHUB = "github",
  YOUTUBE = "youtube",
  X = "x",
  REDDIT = "reddit",
  ARXIV = "arxiv",
  WECHAT = "wechat",
  BILIBILI = "bilibili",
  IMDB = "imdb",
  WIKIPEDIA = "wikipedia",
  GROKIPEDIA = "grokipedia",
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
  WEEK = "week",
  MONTH = "month",
  YEAR = "year"
}

export interface SearchArgs {
  query: string;
  max_results?: number;
  page?: number;
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
    page,
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

  if (page !== undefined && (!Number.isInteger(page) || page < 1 || page > 100)) {
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

export type NewsResult = SearchResult;

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

export interface AskResult {
  title: string;
  link: string;
  snippet: string;
  published_date?: string;
  source: string;
  relevance: number;
}

export interface AskResponse {
  query: string;
  intent: {
    search_query: string;
    sources: string[];
    time_range: "day" | "week" | "month" | "year" | null;
  };
  results: AskResult[];
  errors: Array<{ source: string; message: string }>;
}

export interface AskArgs {
  query: string;
}

export function isValidAskArgs(args: unknown): args is AskArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { query } = args as AskArgs;

  return typeof query === 'string' && query.trim().length > 0 && query.length <= 500;
}

export interface MapsPlace {
  position: number;
  name: string;
  place_id: string;
  maps_url: string;
  address?: string;
  phone?: string;
  website?: string;
  thumbnail?: string;
  category?: string;
  categories?: string[];
  rating?: number;
  review_count?: number;
  coordinates?: { latitude: number; longitude: number };
  opening_hours?: Partial<Record<string, string>>;
  open_state?: string;
  price?: string;
  description?: string;
}

export interface MapsResponse {
  searchParameters: Record<string, unknown>;
  results: MapsPlace[];
}

export interface MapsArgs {
  query: string;
  country?: string;
  language?: string;
  location?: { latitude: number; longitude: number; zoom?: number };
  page?: number;
  max_results?: number;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function isValidMapsArgs(args: unknown): args is MapsArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { query, country, language, location, page, max_results } = args as MapsArgs;

  if (typeof query !== 'string' || query.trim().length === 0 || query.length > 1000) {
    return false;
  }
  if (country !== undefined && (typeof country !== 'string' || !/^[a-zA-Z]{2}$/.test(country))) {
    return false;
  }
  if (language !== undefined && (typeof language !== 'string' || !/^[a-z]{2,3}(-[a-zA-Z]{2,4})?$/.test(language))) {
    return false;
  }
  if (location !== undefined) {
    if (typeof location !== 'object' || location === null) {
      return false;
    }
    if (!isNumberInRange(location.latitude, -90, 90) || !isNumberInRange(location.longitude, -180, 180)) {
      return false;
    }
    if (location.zoom !== undefined && !isNumberInRange(location.zoom, 3, 30)) {
      return false;
    }
  }
  if (page !== undefined && (!Number.isInteger(page) || page < 1 || page > 6)) {
    return false;
  }
  if (page !== undefined && page > 1 && location === undefined) {
    return false;
  }
  if (max_results !== undefined && (!Number.isInteger(max_results) || max_results < 1 || max_results > 20)) {
    return false;
  }

  return true;
}

export interface DeepcrawlStats {
  discovered: number;
  matched: number;
  skipped: number;
  crawled: number;
  failed: number;
}

export interface DeepcrawlPage {
  url: string;
  title: string | null;
  content: string;
}

export interface DeepcrawlStartResponse {
  taskId: string;
  status: string;
}

export interface DeepcrawlStatusResponse {
  taskId: string;
  status?: string;
  message?: string;
  error?: string | null;
  format?: string;
  stats?: DeepcrawlStats;
  failed?: Array<{ url: string; error: string }>;
  resultUrl?: string | null;
  pages?: DeepcrawlPage[];
}

export interface DeepcrawlArgs {
  url?: string;
  task_id?: string;
  type?: 'sitemap' | 'all';
  max_pages?: number;
  include_paths?: string[];
  exclude_paths?: string[];
}

export const DEEPCRAWL_MAX_PAGES = 50;

function isValidPathRules(rules: unknown): boolean {
  return (
    Array.isArray(rules) &&
    rules.length <= 20 &&
    rules.every((rule) => typeof rule === 'string' && rule.length >= 1 && rule.length <= 200)
  );
}

/**
 * Either `task_id` (check an earlier crawl) or `url` (start a new one) is
 * required. With `task_id`, the crawl options are ignored.
 */
export function isValidDeepcrawlArgs(args: unknown): args is DeepcrawlArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }

  const { url, task_id, type, max_pages, include_paths, exclude_paths } = args as DeepcrawlArgs;

  if (task_id !== undefined) {
    return typeof task_id === 'string' && task_id.trim().length > 0 && task_id.length <= 200;
  }

  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }
  if (type !== undefined && type !== 'sitemap' && type !== 'all') {
    return false;
  }
  if (max_pages !== undefined && (!Number.isInteger(max_pages) || max_pages < 1 || max_pages > DEEPCRAWL_MAX_PAGES)) {
    return false;
  }
  if (include_paths !== undefined && !isValidPathRules(include_paths)) {
    return false;
  }
  if (exclude_paths !== undefined && !isValidPathRules(exclude_paths)) {
    return false;
  }

  return true;
}
