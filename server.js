require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 4173;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = (process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"]
);

console.log("Gemini key loaded:", Boolean(GEMINI_API_KEY));
if (!GEMINI_API_KEY) {
  console.warn("WARNING: Missing GEMINI_API_KEY. Create a .env file or start with set GEMINI_API_KEY=your_key_here");
}

const publicDir = __dirname;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("File is too large. Please use an image or PDF under 12 MB."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    // Continue to extract JSON from model text.
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function friendlyGeminiError(status, bodyText, model) {
  let message = `Gemini request failed (${status}) using ${model}.`;
  let code = "GEMINI_ERROR";

  try {
    const parsed = JSON.parse(bodyText);
    message = parsed.error?.message || message;
    code = parsed.error?.status || code;
  } catch (_) {
    if (bodyText) message = bodyText;
  }

  const error = new Error(message);
  error.status = status;
  error.code = status === 429 ? "GEMINI_QUOTA_EXCEEDED" : code;
  error.model = model;
  return error;
}

async function callGemini(model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const resultText = await response.text();
  if (!response.ok) {
    throw friendlyGeminiError(response.status, resultText, model);
  }

  return JSON.parse(resultText);
}

async function analyzeInvoice(payload) {
  if (!GEMINI_API_KEY) {
    const error = new Error("Missing GEMINI_API_KEY. Create a .env file with GEMINI_API_KEY=your_key_here, or run set GEMINI_API_KEY=your_key_here before npm start.");
    error.status = 500;
    error.code = "MISSING_GEMINI_API_KEY";
    throw error;
  }

  const prompt = `Read this restaurant invoice, including US Foods, Sysco, GFS, PFG, cleaning vendors, supply vendors, beverage vendors, and common restaurant invoice formats.

Return ONLY valid JSON with this exact shape:
{
  "vendorName": "",
  "invoiceNumber": "",
  "invoiceDate": "",
  "dueDate": "",
  "total": 0,
  "tax": 0,
  "category": "Food|Supplies|Cleaning|Equipment|Maintenance|Utilities|Beverage|Packaging|Other",
  "confidence": 0,
  "summary": "",
  "lineItems": [
    {"description": "", "quantity": "", "unitPrice": 0, "total": 0, "category": ""}
  ]
}

Use blank strings for missing text fields and 0 for missing amounts. Categorize restaurant expenses carefully. Do not include markdown.`;

  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: payload.mimeType || "image/jpeg",
            data: payload.base64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      console.log("Trying Gemini model:", model);
      const result = await callGemini(model, body);
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
      const parsed = extractJson(text);
      if (!parsed) throw new Error(`Gemini model ${model} did not return readable invoice JSON.`);
      parsed.modelUsed = model;
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(`Gemini model failed: ${model} - ${error.message}`);
      if (error.code === "GEMINI_QUOTA_EXCEEDED" || error.status === 401 || error.status === 403) {
        break;
      }
    }
  }

  throw lastError || new Error("No Gemini model succeeded.");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/read-invoice") {
    try {
      const rawBody = await readBody(req);
      const body = JSON.parse(rawBody || "{}");
      if (!body.base64) {
        return sendJson(res, 400, { code: "MISSING_FILE", error: "Missing invoice file data." });
      }

      const invoice = await analyzeInvoice(body);
      return sendJson(res, 200, { invoice });
    } catch (error) {
      console.error(error);

      if (error.code === "GEMINI_QUOTA_EXCEEDED") {
        return sendJson(res, 429, {
          code: error.code,
          error: "Gemini quota is exceeded for this API key. Manual invoice entry is still available. Add billing, wait for quota reset, or use a different Gemini API key."
        });
      }

      return sendJson(res, error.status || 500, {
        code: error.code || "SERVER_ERROR",
        error: error.message || "Server error."
      });
    }
  }

  let filePath = url.pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, url.pathname);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(publicDir)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Resta Pay running at http://localhost:${PORT}`);
});
