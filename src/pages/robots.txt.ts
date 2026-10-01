import type { APIRoute } from "astro";

import { originOf, textResponse } from "../lib/seo/text-endpoint";

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
];

const DISALLOW = ["/admin", "/api/"];

export const GET: APIRoute = ({ site }) => {
  const origin = originOf(site);

  const groups = [
    [
      "User-agent: *",
      ...DISALLOW.map((path) => `Disallow: ${path}`),
      "Allow: /",
    ],
    ...AI_CRAWLERS.map((agent) => [
      `User-agent: ${agent}`,
      ...DISALLOW.map((path) => `Disallow: ${path}`),
      "Allow: /",
    ]),
  ];

  const body = [
    ...groups.map((group) => group.join("\n")),
    [
      `Sitemap: ${origin}/sitemap-index.xml`,
      `# LLM index: ${origin}/llms.txt`,
    ].join("\n"),
  ].join("\n\n");

  return textResponse(`${body}\n`);
};
