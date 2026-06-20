/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Shared server-side Google GenAI client (lazy setup)
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI features");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// RESTAPAY AI Invoice Reader API route
app.post("/api/read-invoice", async (req: Request, res: Response) => {
  try {
    const { base64, mimeType } = req.body;
    if (!base64) {
      res.status(400).json({ error: "Missing invoice file data (base64)" });
      return;
    }

    const ai = getGenAI();

    const systemPrompt = `You are a professional restaurant payroll and vendor operations specialist.
Read the attached invoice image or document and extract the billing information.
Make sure to classify the invoice category accurately into one of: 'Food', 'Supplies', 'Cleaning', 'Equipment', 'Maintenance', 'Utilities', 'Beverage', 'Packaging', or 'Other'.

Return a JSON object conforming perfectly to the schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        vendorName: { type: Type.STRING, description: "The name of the vendor/supplier" },
        invoiceNumber: { type: Type.STRING, description: "The invoice number" },
        invoiceDate: { type: Type.STRING, description: "The invoice date (YYYY-MM-DD)" },
        dueDate: { type: Type.STRING, description: "The invoice payment due date (YYYY-MM-DD) if available" },
        total: { type: Type.NUMBER, description: "The total payment amount on the invoice" },
        tax: { type: Type.NUMBER, description: "The total tax amount on the invoice" },
        category: { type: Type.STRING, description: "Must be one of: Food, Supplies, Cleaning, Equipment, Maintenance, Utilities, Beverage, Packaging, Other" },
        confidence: { type: Type.NUMBER, description: "Your scanner confidence level as a fraction from 0.0 to 1.0" },
        summary: { type: Type.STRING, description: "A brief 1-sentence summary of the main items purchased" },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING, description: "Item description/name" },
              quantity: { type: Type.STRING, description: "Quantity / volume pack size (e.g. '1 cs', '5 lbs')" },
              unitPrice: { type: Type.NUMBER, description: "The individual unit price" },
              total: { type: Type.NUMBER, description: "The total item price" },
              category: { type: Type.STRING, description: "The estimated category for this line item" }
            },
            required: ["description", "total"]
          }
        }
      },
      required: ["vendorName", "invoiceDate", "total", "category"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: systemPrompt },
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: base64,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const resultText = response.text || "{}";
    const invoiceData = JSON.parse(resultText);

    res.json({ invoice: invoiceData });
  } catch (error: any) {
    console.error("AI Invoice reading error:", error);
    res.status(500).json({
      error: error.message || "Failed to process target invoice using Gemini AI.",
      code: "AI_ERROR"
    });
  }
});

// Serve health endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Configure Vite middleware in development or serve built files in production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RestaPay Full-Stack] Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Server boot error:", err);
});
