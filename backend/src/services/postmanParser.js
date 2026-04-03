/**
 * Postman Collection Parser
 * Parses Postman v2.1 collections and extracts normalized requests
 */

/**
 * Resolve variables in strings (e.g., {{base_url}} -> actual value)
 */
function resolveVariables(str, variables = {}) {
  if (!str || typeof str !== 'string') return str;

  let resolved = str;
  const varMatches = str.match(/\{\{([^}]+)\}\}/g) || [];

  varMatches.forEach(match => {
    const varName = match.replace(/[{}]/g, '');
    if (variables[varName]) {
      resolved = resolved.replace(match, variables[varName]);
    }
  });

  return resolved;
}

/**
 * Extract headers object
 */
function extractHeaders(headerArray = []) {
  const headers = {};

  if (Array.isArray(headerArray)) {
    headerArray.forEach(header => {
      if (header.key && header.value && header.disabled !== true) {
        headers[header.key] = header.value;
      }
    });
  }

  return headers;
}

/**
 * Extract body content
 */
function extractBody(bodyObj) {
  if (!bodyObj) return null;

  if (bodyObj.raw) {
    try {
      return typeof bodyObj.raw === 'string' ? JSON.parse(bodyObj.raw) : bodyObj.raw;
    } catch {
      return bodyObj.raw;
    }
  }

  if (bodyObj.formdata) {
    const form = {};
    bodyObj.formdata.forEach(item => {
      if (item.key && item.value) {
        form[item.key] = item.value;
      }
    });
    return form;
  }

  if (bodyObj.urlencoded) {
    const form = {};
    bodyObj.urlencoded.forEach(item => {
      if (item.key && item.value) {
        form[item.key] = item.value;
      }
    });
    return form;
  }

  return null;
}

/**
 * Normalize a single request
 */
function normalizeRequest(request, variables = {}) {
  // Handle both direct request object and request reference
  const req = request.request || request;

  if (!req) return null;

  const method = (req.method || 'GET').toUpperCase();

  // Extract URL
  let url = '';
  if (typeof req.url === 'string') {
    url = req.url;
  } else if (typeof req.url === 'object' && req.url.raw) {
    url = req.url.raw;
  }

  if (!url) return null;

  // Resolve variables
  url = resolveVariables(url, variables);

  // Extract headers
  const headers = extractHeaders(req.header);

  // Extract body
  const body = extractBody(req.body);

  return {
    method,
    url,
    headers,
    body: body || undefined,
    name: request.name || url,
  };
}

/**
 * Recursively parse items from collection
 */
function parseItems(items = [], variables = {}) {
  const requests = [];

  items.forEach(item => {
    // Folder with sub-items (recursive)
    if (item.item && Array.isArray(item.item)) {
      const subRequests = parseItems(item.item, variables);
      requests.push(...subRequests);
    }
    // Direct request
    else if (item.request) {
      const normalized = normalizeRequest(item, variables);
      if (normalized) {
        requests.push(normalized);
      }
    }
  });

  return requests;
}

/**
 * Main parser function
 * Parses Postman v2.1 collection format
 */
function parseCollection(collection) {
  if (!collection || !collection.item) {
    return [];
  }

  // Extract collection-level variables
  const variables = {};
  if (collection.variable && Array.isArray(collection.variable)) {
    collection.variable.forEach(variable => {
      if (variable.key && variable.value) {
        variables[variable.key] = variable.value;
      }
    });
  }

  // Parse all items
  const requests = parseItems(collection.item, variables);

  return requests;
}

module.exports = {
  parseCollection,
  normalizeRequest,
  resolveVariables,
  extractHeaders,
  extractBody,
};
