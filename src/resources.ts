import { ResourceNotFoundError, type Resource } from "@modelcontextprotocol/server";
import { log } from "./utils.js";

/**
 * Define the default search query result resource
 */
export const DEFAULT_SEARCH_RESOURCE: Resource = {
  uri: "search1api://info",
  name: "Search1API Information",
  description: "Basic information about Search1API capabilities",
  mimeType: "application/json"
};

/**
 * List of all available resources
 */
export const RESOURCES = [DEFAULT_SEARCH_RESOURCE];

/**
 * Handle list resources request
 */
export function handleListResources(): Resource[] {
  log("Handling list resources request");
  return RESOURCES;
}

/**
 * Handle read resource request
 * @param resourceUri The resource URI to read
 */
export function handleReadResource(resourceUri: string): Resource {
  log(`Handling read resource request for ${resourceUri}`);

  const resource = RESOURCES.find((r) => r.uri === resourceUri);

  if (!resource) {
    throw new ResourceNotFoundError(resourceUri);
  }

  return resource;
}
