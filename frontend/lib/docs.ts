import { canonicalUrl } from "./site-url";

export type DocSection = {
  title: string;
  body: string;
  bullets?: string[];
  code?: string;
  language?: string;
  filename?: string;
};

export type DocPage = {
  slug: string;
  title: string;
  summary: string;
  kicker: string;
  readingTime: string;
  sections: DocSection[];
};

export type DocsNavItem = {
  title: string;
  href: string;
  slug?: string;
  description?: string;
};

export type DocsNavGroup = {
  title: string;
  items: DocsNavItem[];
};

export type DocsFeatureCard = {
  title: string;
  description: string;
  snippet: string;
  href: string;
};

export type ApiReferenceParameter = {
  name: string;
  type: string;
  required: string;
  description: string;
};

export type ApiReferenceCodeExample = {
  label: string;
  language: string;
  filename: string;
  code: string;
};

export type ApiReferenceEndpoint = {
  id: string;
  group: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  title: string;
  description: string;
  authLabel: string;
  authDescription: string;
  parameters: ApiReferenceParameter[];
  requestExamples: ApiReferenceCodeExample[];
  responseSchema: string;
  responseExample: string;
};

export type DocsSearchEntry = {
  title: string;
  description: string;
  href: string;
  category: string;
};

// Base URL for API
export const API_BASE_URL = "https://api.cerul.ai";

export const docsNavigation = [
  { href: "#introduction", label: "Introduction", index: "01" },
  { href: "#authentication", label: "Authentication", index: "02" },
  { href: "#search", label: "Search API", index: "03" },
  { href: "#usage", label: "Usage API", index: "04" },
  { href: "#response", label: "Response Format", index: "05" },
] as const;

export const docsLandingSections = [
  {
    id: "introduction",
    kicker: "Getting Started",
    title: "Cerul API Overview",
    description:
      "The Cerul API lets AI agents search video by meaning — across visual scenes, speech, and on-screen text. One endpoint, one API key, grounded results with timestamps.",
    list: [
      "Base URL: https://api.cerul.ai",
      "Bearer token authentication",
      "JSON request and response bodies",
    ],
    code: undefined,
  },
  {
    id: "authentication",
    kicker: "Authentication",
    title: "API Key Authentication",
    description:
      "Include your API key in the Authorization header as a Bearer token. Create and manage keys from your dashboard.",
    list: [
      "Authorization: Bearer YOUR_CERUL_API_KEY",
      "Free tier: 1,000 requests/month, no credit card",
      "Keys start with cerul_ prefix",
    ],
    code: `curl "${API_BASE_URL}/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{"query": "your search query"}'`,
    language: "bash",
    filename: "auth.sh",
  },
  {
    id: "search",
    kicker: "Core Endpoint",
    title: "POST /v1/search",
    description:
      "Send a natural-language query, get back timestamped video segments with relevance scores and source links. Cerul blends visual, speech, and summary evidence automatically.",
    list: [
      "query (required): natural-language search",
      "max_results: 1–20 (default 5)",
      "include_answer: AI-generated summary from matched evidence",
    ],
    code: `curl "${API_BASE_URL}/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{
    "query": "Sam Altman views on AI video generation tools",
    "max_results": 5,
    "include_answer": true
  }'`,
    language: "bash",
    filename: "search.sh",
  },
  {
    id: "usage",
    kicker: "Monitoring",
    title: "GET /v1/usage",
    description:
      "Check your current request count, remaining quota, and rate limits. Call this before scaling traffic.",
    list: [
      "Current billing period and request counts",
      "Rate limit status per tier",
      "No request body needed",
    ],
    code: `curl "${API_BASE_URL}/v1/usage" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY"`,
    language: "bash",
    filename: "usage.sh",
  },
  {
    id: "response",
    kicker: "Response Format",
    title: "Understanding Responses",
    description:
      "All responses return JSON. Each search result includes a relevance score, timestamps, source metadata, and a tracking URL that redirects to the original video.",
    list: [
      "results[]: array of matched video segments",
      "score: relevance from 0.0 to 1.0",
      "url: Cerul tracking link → redirects to source",
      "unit_type: summary, speech, or visual",
    ],
    code: `{
  "results": [
    {
      "id": "unit_hmtuvNfytjM_1223",
      "score": 0.92,
      "url": "https://cerul.ai/v/a8f3k2x",
      "title": "Sam Altman on AGI Timeline",
      "snippet": "AGI is coming sooner than most people expect.",
      "thumbnail_url": "https://i.ytimg.com/vi/hmtuvNfytjM/hqdefault.jpg",
      "source": "youtube",
      "speaker": "Sam Altman",
      "timestamp_start": 1223.0,
      "timestamp_end": 1345.0,
      "unit_type": "speech"
    }
  ],
  "answer": "Summary grounded in the matched evidence.",
  "credits_used": 1,
  "credits_remaining": 999,
  "request_id": "req_abc123xyz"
}`,
    language: "json",
    filename: "response.json",
  },
] as const;

export const docsPages: DocPage[] = [
  {
    slug: "quickstart",
    title: "Quickstart",
    summary: "Get your API key and make your first search request in under 5 minutes.",
    kicker: "Get started",
    readingTime: "3 min",
    sections: [
      {
        title: "Get your API key",
        body:
          "Sign up at cerul.ai and create an API key from the dashboard. The free tier gives you 1,000 requests per month — no credit card required.",
        bullets: [
          "Sign up at cerul.ai/signup",
          "Go to Dashboard → Settings → API Keys",
          "Create a key and copy it (starts with cerul_)",
        ],
      },
      {
        title: "Make your first search",
        body:
          "Replace YOUR_CERUL_API_KEY with your actual key. This searches across visual scenes, speech, and on-screen text in one call.",
        code: `curl "https://api.cerul.ai/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{
    "query": "Sam Altman views on AI video generation",
    "max_results": 3
  }'`,
        language: "bash",
        filename: "search.sh",
      },
      {
        title: "Understand the response",
        body:
          "Each result includes a relevance score, timestamps, source metadata, and a tracking URL that redirects to the original video.",
        code: `{
  "results": [
    {
      "id": "unit_hmtuvNfytjM_1223",
      "score": 0.92,
      "url": "https://cerul.ai/v/a8f3k2x",
      "title": "Sam Altman on AGI Timeline",
      "snippet": "AGI is coming sooner than most people expect.",
      "thumbnail_url": "https://i.ytimg.com/vi/hmtuvNfytjM/hqdefault.jpg",
      "source": "youtube",
      "speaker": "Sam Altman",
      "timestamp_start": 1223.0,
      "timestamp_end": 1345.0,
      "unit_type": "speech"
    }
  ],
  "credits_used": 1,
  "credits_remaining": 999,
  "request_id": "req_abc123xyz"
}`,
        language: "json",
        filename: "response.json",
      },
      {
        title: "Check your usage",
        body:
          "Monitor your request count and remaining quota before scaling traffic.",
        code: `curl "https://api.cerul.ai/v1/usage" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY"`,
        language: "bash",
        filename: "usage.sh",
      },
    ],
  },
  {
    slug: "search-api",
    title: "Search",
    summary: "Full reference for POST /v1/search — parameters, filters, response fields, and examples.",
    kicker: "API reference",
    readingTime: "5 min",
    sections: [
      {
        title: "Endpoint",
        body:
          "Send a POST request with a JSON body. Cerul returns ranked video segments that match your query across speech, visual, and summary evidence.",
        code: `POST https://api.cerul.ai/v1/search
Authorization: Bearer YOUR_CERUL_API_KEY`,
        language: "http",
        filename: "endpoint.http",
      },
      {
        title: "Request body",
        body:
          "Only query is required. All other fields are optional.",
        code: `{
  "query": "string (required)",
  "max_results": 5,          // 1–20, default 5
  "include_answer": false,   // AI summary from matched evidence
  "filters": {
    "speaker": "string",
    "source": "string",
    "published_after": "YYYY-MM-DD",
    "min_duration": 0,
    "max_duration": 0
  }
}`,
        language: "json",
        filename: "params.json",
      },
      {
        title: "Basic search",
        body:
          "The simplest request — just a query string.",
        code: `curl "https://api.cerul.ai/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{"query": "how transformers work explained visually"}'`,
        language: "bash",
        filename: "basic.sh",
      },
      {
        title: "Search with answer",
        body:
          "Set include_answer to true to get a grounded summary synthesized from the matched evidence.",
        code: `curl "https://api.cerul.ai/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{
    "query": "Sam Altman explains the AGI timeline",
    "include_answer": true,
    "max_results": 5
  }'`,
        language: "bash",
        filename: "with-answer.sh",
      },
      {
        title: "Response",
        body:
          "Each result in the array represents a matched video segment. The unit_type field tells you whether the match came from a summary, speech transcript, or visual keyframe.",
        code: `{
  "results": [{
    "id": "string",
    "score": 0.92,             // 0.0–1.0
    "url": "string",           // Cerul tracking URL → redirects to source
    "title": "string",
    "snippet": "string",
    "thumbnail_url": "string",
    "source": "string",
    "speaker": "string | null",
    "timestamp_start": 1223.0,
    "timestamp_end": 1345.0,
    "unit_type": "speech"      // summary | speech | visual
  }],
  "answer": "string | null",   // only if include_answer: true
  "credits_used": 1,
  "credits_remaining": 999,
  "request_id": "req_abc123xyz"
}`,
        language: "json",
        filename: "response.json",
      },
    ],
  },
  {
    slug: "usage-api",
    title: "Usage",
    summary: "Monitor your request count, remaining quota, and rate limits with GET /v1/usage.",
    kicker: "API reference",
    readingTime: "2 min",
    sections: [
      {
        title: "Check usage",
        body:
          "Returns your current billing period, request count, and rate limit. No request body needed.",
        code: `curl "https://api.cerul.ai/v1/usage" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY"`,
        language: "bash",
        filename: "usage.sh",
      },
      {
        title: "Response",
        body:
          "The response includes your plan tier, billing window, and quota information.",
        code: `{
  "tier": "free",
  "period_start": "2026-03-01",
  "period_end": "2026-03-31",
  "requests_limit": 1000,
  "requests_used": 128,
  "requests_remaining": 872,
  "rate_limit_per_sec": 1
}`,
        language: "json",
        filename: "usage-response.json",
      },
      {
        title: "Rate limits",
        body:
          "Requests exceeding your rate limit return HTTP 429. The limit resets every second.",
        bullets: [
          "Free: 1 request/second, 1,000 requests/month",
          "Pay as you go: 5 requests/second",
          "Monthly: 10 requests/second, 5,000 requests included",
          "Enterprise: custom limits",
        ],
      },
    ],
  },
];

export function getDocBySlug(slug: string): DocPage | undefined {
  return docsPages.find((page) => page.slug === slug);
}

export function getDocsStaticParams() {
  return docsPages.map((page) => ({ slug: page.slug }));
}

export function getDocsIndexCards() {
  return docsPages.map((page) => ({
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    kicker: page.kicker,
    readingTime: page.readingTime,
    href: `/docs/${page.slug}` as const,
  }));
}

export function getDocsPageCanonical(slug: string): string {
  return canonicalUrl(`/docs/${slug}`);
}

export const docsSidebarGroups: DocsNavGroup[] = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Overview",
        href: "/docs",
        description: "Introduction and quick navigation",
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        slug: "quickstart",
        description: "Get your key and make the first request",
      },
    ],
  },
  {
    title: "API Reference",
    items: [
      {
        title: "Search",
        href: "/docs/search-api",
        slug: "search-api",
        description: "POST /v1/search",
      },
      {
        title: "Usage",
        href: "/docs/usage-api",
        slug: "usage-api",
        description: "GET /v1/usage",
      },
      {
        title: "All Endpoints",
        href: "/docs/api-reference",
        slug: "api-reference",
        description: "Full endpoint reference",
      },
    ],
  },
];

export const docsShellTabs = [
  { label: "Overview", href: "/docs" },
  { label: "Quickstart", href: "/docs/quickstart" },
  { label: "API Reference", href: "/docs/api-reference" },
  { label: "Pricing", href: "/pricing" },
] as const;

export const docsUtilityLinks = [
  {
    title: "Quickstart",
    href: "/docs/quickstart",
    description: "Get your key and make the first request.",
  },
  {
    title: "GitHub",
    href: "https://github.com/JessyTsui/cerul",
    description: "Source code and examples.",
  },
  {
    title: "Support",
    href: "mailto:support@cerul.ai",
    description: "Contact the team.",
  },
] as const;

export const docsPopularTopics = [
  {
    title: "Make your first request",
    href: "/docs/quickstart",
    description: "Get an API key and search videos in under 5 minutes.",
  },
  {
    title: "Search parameters",
    href: "/docs/search-api",
    description: "All the fields you can send to POST /v1/search.",
  },
  {
    title: "Rate limits and quotas",
    href: "/docs/usage-api",
    description: "Understand your tier limits before scaling traffic.",
  },
  {
    title: "Full endpoint reference",
    href: "/docs/api-reference",
    description: "Request and response schemas for every public route.",
  },
] as const;

export const docsFeatureCards: DocsFeatureCard[] = [
  {
    title: "Authentication",
    description: "Bearer token with API keys from the dashboard.",
    snippet: "Authorization: Bearer <KEY>",
    href: "/docs/quickstart",
  },
  {
    title: "Search",
    description: "Search videos by meaning across speech, visuals, and text.",
    snippet: "POST /v1/search",
    href: "/docs/search-api",
  },
  {
    title: "Usage",
    description: "Check request counts, quotas, and rate limits.",
    snippet: "GET /v1/usage",
    href: "/docs/usage-api",
  },
] as const;

export function getDocsSearchEntries(): DocsSearchEntry[] {
  return [
    ...docsPages.map((page) => ({
      title: page.title,
      description: page.summary,
      href: `/docs/${page.slug}`,
      category: page.kicker,
    })),
    {
      title: "Documentation overview",
      description: "Landing page and quick navigation for the Cerul public docs.",
      href: "/docs",
      category: "Home",
    },
    ...apiReferenceEndpoints.map((endpoint) => ({
      title: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.title,
      href: `/docs/api-reference#${endpoint.id}`,
      category: endpoint.group,
    })),
  ];
}

export const apiReferenceEndpoints: ApiReferenceEndpoint[] = [
  {
    id: "search-v1",
    group: "Search",
    method: "POST",
    path: "/v1/search",
    title: "Search videos",
    description:
      "Search across visual scenes, speech, and on-screen text in one call. Returns ranked video segments with relevance scores, timestamps, and source links.",
    authLabel: "Bearer API key",
    authDescription:
      "Requires a Cerul API key in the Authorization header.",
    parameters: [
      {
        name: "query",
        type: "string",
        required: "Required",
        description: "Natural-language search query (max 400 characters).",
      },
      {
        name: "max_results",
        type: "integer",
        required: "Optional",
        description: "Number of results to return, 1–20. Default: 5.",
      },
      {
        name: "include_answer",
        type: "boolean",
        required: "Optional",
        description: "Generate an AI summary grounded in the matched evidence. Default: false.",
      },
      {
        name: "filters",
        type: "object",
        required: "Optional",
        description:
          "Filter results by speaker, source, published_after (YYYY-MM-DD), min_duration, or max_duration (seconds).",
      },
    ],
    requestExamples: [
      {
        label: "cURL",
        language: "bash",
        filename: "search.sh",
        code: `curl "https://api.cerul.ai/v1/search" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY" \\
  -d '{
    "query": "Sam Altman views on AI video generation tools",
    "max_results": 5,
    "include_answer": true
  }'`,
      },
      {
        label: "Python",
        language: "python",
        filename: "search.py",
        code: `import requests

response = requests.post(
    "https://api.cerul.ai/v1/search",
    headers={"Authorization": "Bearer YOUR_CERUL_API_KEY"},
    json={
        "query": "Sam Altman views on AI video generation tools",
        "max_results": 5,
        "include_answer": True,
    },
)

print(response.json())`,
      },
      {
        label: "JavaScript",
        language: "javascript",
        filename: "search.js",
        code: `const response = await fetch("https://api.cerul.ai/v1/search", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_CERUL_API_KEY",
  },
  body: JSON.stringify({
    query: "Sam Altman views on AI video generation tools",
    max_results: 5,
    include_answer: true,
  }),
});

const data = await response.json();
console.log(data);`,
      },
    ],
    responseSchema: `{
  "results": [
    {
      "id": "string",
      "score": "number (0.0–1.0)",
      "url": "string (tracking URL → redirects to source)",
      "title": "string",
      "snippet": "string",
      "thumbnail_url": "string",
      "source": "string",
      "speaker": "string | null",
      "timestamp_start": "number | null",
      "timestamp_end": "number | null",
      "unit_type": "summary | speech | visual"
    }
  ],
  "answer": "string | null",
  "credits_used": "integer",
  "credits_remaining": "integer",
  "request_id": "string"
}`,
    responseExample: `{
  "results": [
    {
      "id": "unit_hmtuvNfytjM_1223",
      "score": 0.93,
      "url": "https://cerul.ai/v/a8f3k2x",
      "title": "Sam Altman on AI video generation",
      "snippet": "Current AI video generation tools are improving quickly but still constrained by controllability.",
      "thumbnail_url": "https://i.ytimg.com/vi/hmtuvNfytjM/hqdefault.jpg",
      "source": "youtube",
      "speaker": "Sam Altman",
      "timestamp_start": 1223.0,
      "timestamp_end": 1345.0,
      "unit_type": "speech"
    }
  ],
  "answer": "Sam Altman frames current AI video generation tools as improving quickly but still constrained by controllability and production reliability.",
  "credits_used": 2,
  "credits_remaining": 998,
  "request_id": "req_9f8c1d5b2a9f7d1a8c4e6b02"
}`,
  },
  {
    id: "usage-v1",
    group: "Usage",
    method: "GET",
    path: "/v1/usage",
    title: "Check usage",
    description: "Returns your current plan tier, billing period, request counts, and rate limit.",
    authLabel: "Bearer API key",
    authDescription:
      "Requires a Cerul API key. Use this to monitor usage before scaling traffic.",
    parameters: [],
    requestExamples: [
      {
        label: "cURL",
        language: "bash",
        filename: "usage.sh",
        code: `curl "https://api.cerul.ai/v1/usage" \\
  -H "Authorization: Bearer YOUR_CERUL_API_KEY"`,
      },
      {
        label: "Python",
        language: "python",
        filename: "usage.py",
        code: `import requests

response = requests.get(
    "https://api.cerul.ai/v1/usage",
    headers={"Authorization": "Bearer YOUR_CERUL_API_KEY"},
)

print(response.json())`,
      },
      {
        label: "JavaScript",
        language: "javascript",
        filename: "usage.js",
        code: `const response = await fetch("https://api.cerul.ai/v1/usage", {
  headers: {
    "Authorization": "Bearer YOUR_CERUL_API_KEY",
  },
});

const data = await response.json();
console.log(data);`,
      },
    ],
    responseSchema: `{
  "tier": "string",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "requests_limit": "integer",
  "requests_used": "integer",
  "requests_remaining": "integer",
  "rate_limit_per_sec": "integer"
}`,
    responseExample: `{
  "tier": "free",
  "period_start": "2026-03-01",
  "period_end": "2026-03-31",
  "requests_limit": 1000,
  "requests_used": 128,
  "requests_remaining": 872,
  "rate_limit_per_sec": 1
}`,
  },
] as const;

export function getApiReferenceEndpoint(endpointId = "search-v1") {
  return (
    apiReferenceEndpoints.find((endpoint) => endpoint.id === endpointId)
    ?? apiReferenceEndpoints[0]
  );
}
