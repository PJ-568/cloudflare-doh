/**
 * Cloudflare Worker that forwards requests based on path instead of subdomain
 * Example: doh.example.com/google/query-dns → dns.google/dns-query
 * Supports configuration via Cloudflare Worker variables
 */

// Default configuration for path mappings
const DEFAULT_PATH_MAPPINGS = {
	'/google': {
		targetDomain: 'dns.google',
		pathMapping: {
			'/query-dns': '/dns-query',
		},
	},
	'/': {
		targetDomain: 'one.one.one.one',
		pathMapping: {
			'/query-dns': '/dns-query',
		},
	},
	'/cloudflare': {
		targetDomain: 'one.one.one.one',
		pathMapping: {
			'/query-dns': '/dns-query',
		},
	},
	"/quad9": {
		"targetDomain": "dns.quad9.net",
		"pathMapping": {
			"/query-dns": "/dns-query"
		}
	},
	// Add more path mappings as needed
};

const HOMEPAGE_HTML = `<!DOCTYPE html>
<html lang="zh-Hans" style="height: 100%;">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=width=device-width, initial-scale=1">
  <meta name="description" content="502">
  <meta http-equiv="refresh" content="10;url=https://pj568.eu.org">
  <title>PJ568 | 502</title>
  <link rel="icon" type="image/svg+xml" href="https://blog.PJ568.sbs/images/PJ568.svg">
  <style>
    body {
      background-color: black;
      height: 100%;
      margin: 0;
      padding: 0;
    }

    body>* {
      color: #BDBDBD;
      font-family: 'Maple Mono CN', Arial, sans-serif;
    }

    ::selection {
      background-color: #FFEEEE;
      color: initial;
    }

    .container {
      align-items: center;
      display: flex;
      justify-content: center;
      height: calc(100% - 1rem);
      margin: 0;
      padding-right: 1rem;
      padding-bottom: 1rem;
      flex-direction: column;
    }

    .box {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      max-width: 20rem;
      border: .1rem solid #424242;
      border-radius: 1.5rem;
      overflow: scroll;
      width: calc(100% - 2rem);
      padding-right: 1rem;
      padding-bottom: 1rem;
    }

    .box:hover {
      color: #E0E0E0;
      border: .1rem solid #9E9E9E;
    }

    .child {
      margin-left: 1rem;
      margin-top: 1rem;
    }

    a {
      text-decoration: none;
    }

    h1 {
      font-size: 3rem;
      margin: 0;
    }

    p {
      margin: 0;
    }
  </style>
</head>

<body>
  <a class="container" href="https://pj568.eu.org">
    <div class="box child">
      <h1 class="child">502</h1>
      <p class="child">服务器拒绝请求。点击尝试前往主页。</p>
    </div>
  </a>
</body>

</html>`;

/**
 * Get path mappings from Cloudflare Worker env or use defaults
 * @param {Object} env - Environment variables from Cloudflare Worker
 * @returns {Object} Path mappings configuration
 */
function getPathMappings(env) {
	try {
		// Check if DOMAIN_MAPPINGS is defined in the env object
		if (env && env.DOMAIN_MAPPINGS) {
			// If it's a string, try to parse it as JSON
			if (typeof env.DOMAIN_MAPPINGS === 'string') {
				return JSON.parse(env.DOMAIN_MAPPINGS);
			}
			// If it's already an object, use it directly
			return env.DOMAIN_MAPPINGS;
		}
	} catch (error) {
		console.error('Error accessing DOMAIN_MAPPINGS variable:', error);
	}

	// Fall back to default mappings if the variable is not set
	return DEFAULT_PATH_MAPPINGS;
}

function serveHomepage() {
	// 直接返回内联的HTML内容，不再需要尝试从外部加载
	return new Response(HOMEPAGE_HTML, {
		status: 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

async function handleRequest(request, env) {
	const url = new URL(request.url);
	const path = url.pathname;
	const queryString = url.search; // Preserves the query string with the '?'

	// If the path is explicitly '/index.html' or '/', serve the homepage
	if (path === '/index.html' || path === '/') {
		return serveHomepage();
	}

	// Get the path mappings from env or defaults
	const pathMappings = getPathMappings(env);

	// Find the matching path prefix
	const pathPrefix = Object.keys(pathMappings).find((prefix) => path.startsWith(prefix));

	if (pathPrefix) {
		const mapping = pathMappings[pathPrefix];
		const targetDomain = mapping.targetDomain;

		// Remove the prefix from the path
		const remainingPath = path.substring(pathPrefix.length);

		// Check if we have a specific path mapping for the remaining path
		let targetPath = remainingPath;
		for (const [sourcePath, destPath] of Object.entries(mapping.pathMapping)) {
			if (remainingPath.startsWith(sourcePath)) {
				targetPath = remainingPath.replace(sourcePath, destPath);
				break;
			}
		}

		// Construct the new URL with the preserved query string
		const newUrl = `https://${targetDomain}${targetPath}${queryString}`;

		// Clone the original request
		const newRequest = new Request(newUrl, {
			method: request.method,
			headers: request.headers,
			body: request.body,
			redirect: 'follow',
		});

		// Forward the request to the target domain
		return fetch(newRequest);
	}

	// If no mapping is found, serve the homepage instead of 404
	return serveHomepage();
}

// Export the worker
export default {
	async fetch(request, env, ctx) {
		return handleRequest(request, env);
	},
};



