export type SnippetLang = "curl" | "javascript" | "python";

export interface SnippetOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly brand?: string;
  readonly webhookUrl?: string;
  readonly purpose?: string;
}

const TOPIC_BY_PURPOSE: Record<string, string> = {
  "blog-hero":   "How AI is transforming modern business",
  "social-og":   "Product launch announcement",
  "ad-creative": "SaaS dashboard for growing teams",
  "case-study":  "Customer success story",
  "icon":        "Cloud storage feature icon",
  "infographic": "The state of AI in 2025",
};

export function getSyncSnippet(lang: SnippetLang, opts: SnippetOptions): string {
  const { baseUrl, apiKey, brand = "apexure", purpose = "blog-hero" } = opts;
  const key = apiKey || "YOUR_API_KEY";
  const topic = TOPIC_BY_PURPOSE[purpose] ?? "A modern SaaS dashboard";

  if (lang === "curl") {
    return `curl -X POST ${baseUrl}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "topic": "${topic}",
    "purpose": "${purpose}",
    "brand": "${brand}",
    "output_format": "url",
    "quality": "hd",
    "count": 1
  }'`;
  }

  if (lang === "javascript") {
    return `const response = await fetch("${baseUrl}/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${key}",
  },
  body: JSON.stringify({
    topic: "${topic}",
    purpose: "${purpose}",
    brand: "${brand}",
    output_format: "url",
    quality: "hd",
    count: 1,
  }),
});

const data = await response.json();

if (data.success) {
  // data.images[0].url — direct image URL
  // data.images[0].mimeType — "image/png"
  console.log(data.images[0].url);
}`;
  }

  return `import requests

response = requests.post(
    "${baseUrl}/api/generate",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer ${key}",
    },
    json={
        "topic": "${topic}",
        "purpose": "${purpose}",
        "brand": "${brand}",
        "output_format": "url",
        "quality": "hd",
        "count": 1,
    },
)

data = response.json()

if data["success"]:
    print(data["images"][0]["url"])`;
}

export function getVerifySnippet(lang: SnippetLang): string {
  if (lang === "curl") {
    return `# Webhooks are POST requests — verify in your server, not cURL.
# Use the JavaScript or Python tab for verification code.`;
  }

  if (lang === "javascript") {
    return `import { createHmac, timingSafeEqual } from "crypto";

// In your webhook handler (Express / Next.js / etc.)
function verifyOrbitSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = \`sha256=\${createHmac("sha256", secret).update(rawBody).digest("hex")}\`;
  // Use timing-safe compare to prevent timing attacks
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Example: Next.js API route
export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-orbit-signature") ?? "";

  if (!verifyOrbitSignature(rawBody, sig, process.env.ORBIT_WEBHOOK_SECRET!)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "generation.completed") {
    const imageUrl = event.data.images[0].url;
    // Save imageUrl to your database, attach to blog post, etc.
  }

  return new Response("OK");
}`;
  }

  return `import hmac
import hashlib

def verify_orbit_signature(raw_body: str, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(),
        raw_body.encode(),
        hashlib.sha256
    ).hexdigest()
    # Use compare_digest to prevent timing attacks
    return hmac.compare_digest(expected, signature)

# Example: Flask route
from flask import Flask, request, abort
import os, json

app = Flask(__name__)

@app.post("/webhooks/orbit")
def orbit_webhook():
    raw_body = request.get_data(as_text=True)
    sig = request.headers.get("X-Orbit-Signature", "")

    if not verify_orbit_signature(raw_body, sig, os.environ["ORBIT_WEBHOOK_SECRET"]):
        abort(401)

    event = json.loads(raw_body)

    if event["event"] == "generation.completed":
        image_url = event["data"]["images"][0]["url"]
        # Save image_url to your database, attach to blog post, etc.

    return "OK"`;
}

export function getMcpSnippet(opts: Pick<SnippetOptions, "baseUrl" | "apiKey">): string {
  const { baseUrl, apiKey } = opts;
  const key = apiKey || "YOUR_API_KEY";

  return `// 1. Add Orbit Image to your MCP client config (e.g. Claude Desktop, Cursor)
{
  "mcpServers": {
    "orbit-image": {
      "url": "${baseUrl}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${key}"
      }
    }
  }
}

// 2. Available MCP tools (called automatically by the AI):
//    generate_image  — generate brand-aware images
//    list_brands     — list available brands
//    health_check    — check service status

// 3. Example prompts to give Claude or your AI assistant:
//    "Generate a blog hero image about AI innovation using the apexure brand"
//    "Create 2 social media images for our product launch in apexure style"
//    "Make an ad creative for our SaaS dashboard targeting startup founders"`;
}

export function getAsyncSnippet(opts: SnippetOptions): string {
  const { baseUrl, apiKey, webhookUrl } = opts;
  const key = apiKey || "YOUR_API_KEY";
  const webhook = webhookUrl || "https://yourapp.com/webhooks/orbit";

  return `# 1. Submit async job — returns immediately
curl -X POST ${baseUrl}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "topic": "Product launch hero image",
    "purpose": "blog-hero",
    "output_format": "url",
    "async": true,
    "webhook_url": "${webhook}"
  }'

# Response: { "jobId": "job_abc123", "statusUrl": "..." }

# 2. Orbit calls your webhook when ready:
# POST ${webhook}
# {
#   "event": "generation.completed",
#   "jobId": "job_abc123",
#   "data": { "images": [...] }
# }

# Or poll manually:
curl ${baseUrl}/api/jobs/JOB_ID \\
  -H "Authorization: Bearer ${key}"`;
}
