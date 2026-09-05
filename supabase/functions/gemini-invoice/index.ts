const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']
const MAX_BASE64_LENGTH = 16_800_000
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
])

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function inferMimeType(fileName: string, suppliedMimeType: string) {
  const supplied = clean(suppliedMimeType).toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(supplied)) return supplied

  const lower = clean(fileName).toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.heif')) return 'image/heif'
  return supplied || 'application/octet-stream'
}

function extractJsonText(text: string) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
}

function safeProviderError(raw: string) {
  const text = clean(raw)
  if (!text) return 'No error details were returned by Gemini.'

  try {
    const parsed = JSON.parse(text)
    return clean(parsed?.error?.message || parsed?.message || text)
  } catch {
    return text.slice(0, 1200)
  }
}

function normalizeInvoicePayload(value: any) {
  const lineItems = Array.isArray(value?.lineItems) ? value.lineItems : []
  return {
    vendor_name: clean(value?.vendor_name),
    invoice_number: clean(value?.invoice_number),
    invoice_date: clean(value?.invoice_date),
    due_date: clean(value?.due_date || value?.remit_due_date),
    payment_terms: clean(value?.payment_terms || value?.terms),
    date_ordered: clean(value?.date_ordered),
    shipped_date: clean(value?.shipped_date),
    invoice_type: clean(value?.invoice_type) || 'Regular Invoice',
    category: clean(value?.category) || 'Other',
    total: Number(value?.total || 0),
    sales_subtotal: Number(value?.sales_subtotal || value?.subtotal || 0),
    net_amount: Number(value?.net_amount || value?.net || 0),
    total_discount: Number(value?.total_discount || value?.summary_discount || 0),
    total_charges: Number(value?.total_charges || value?.charges || 0),
    tax: Number(value?.tax || 0),
    freight: Number(value?.freight || 0),
    discount: Number(value?.discount || 0),
    lineItems: lineItems.map((item: any) => ({
      description: clean(item?.description),
      item_number: clean(item?.item_number),
      brand: clean(item?.brand),
      qty: Number(item?.shipped_qty ?? item?.qty ?? 0),
      ordered_qty: Number(item?.ordered_qty ?? 0),
      shipped_qty: Number(item?.shipped_qty ?? item?.qty ?? 0),
      adjusted_qty: Number(item?.adjusted_qty ?? 0),
      unit: clean(item?.unit || item?.sales_unit),
      sales_unit: clean(item?.sales_unit || item?.unit),
      purchase_unit: clean(item?.purchase_unit || item?.sales_unit || item?.unit),
      package_size: clean(item?.package_size),
      pricing_unit: clean(item?.pricing_unit),
      weight: Number(item?.weight ?? 0),
      pack_count: Number(item?.pack_count || 0),
      unit_size_value: Number(item?.unit_size_value || 0),
      unit_size_unit: clean(item?.unit_size_unit),
      unit_price: Number(item?.gross_unit_price ?? item?.unit_price ?? 0),
      gross_unit_price: Number(item?.gross_unit_price ?? item?.unit_price ?? 0),
      discount_per_unit: Number(item?.discount_per_unit ?? item?.discount_amount ?? 0),
      net_unit_price: Number(item?.net_unit_price ?? 0),
      discount_percent: Number(item?.discount_percent || 0),
      discount_amount: Number(item?.discount_amount || 0),
      total: Number(item?.total || 0),
      category: clean(item?.category)
    }))
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed.' }, 405)

  try {
    const apiKey = clean(Deno.env.get('GEMINI_API_KEY'))
    if (!apiKey) {
      console.error('gemini-invoice: GEMINI_API_KEY is missing')
      return jsonResponse({
        ok: false,
        code: 'GEMINI_KEY_MISSING',
        message: 'Gemini OCR is not configured. Add GEMINI_API_KEY to Supabase Edge Function secrets.'
      }, 500)
    }

    let payload: any
    try {
      payload = await request.json()
    } catch (error) {
      console.error('gemini-invoice: invalid JSON body', error)
      return jsonResponse({
        ok: false,
        code: 'INVALID_REQUEST_BODY',
        message: 'The invoice upload request was not valid JSON.'
      }, 400)
    }

    if (payload?.healthCheck === true) {
      return jsonResponse({ ok: true, service: 'gemini-invoice', configured: true, models: clean(Deno.env.get('GEMINI_MODEL')) || DEFAULT_MODELS[0] })
    }

    const fileName = clean(payload?.fileName) || 'invoice'
    const mimeType = inferMimeType(fileName, clean(payload?.mimeType))
    const data = clean(payload?.data).replace(/^data:[^;]+;base64,/, '')

    if (!data) {
      return jsonResponse({ ok: false, code: 'FILE_DATA_MISSING', message: 'Invoice file data is missing.' }, 400)
    }

    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      return jsonResponse({
        ok: false,
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `Gemini OCR supports PDF, JPG, PNG, WEBP, HEIC, and HEIF files. Received: ${mimeType || 'unknown type'}.`
      }, 400)
    }

    if (data.length > MAX_BASE64_LENGTH) {
      return jsonResponse({
        ok: false,
        code: 'FILE_TOO_LARGE',
        message: 'Invoice file is too large. Maximum supported size is approximately 12 MB.'
      }, 413)
    }

    const prompt = `You are an invoice extraction engine for a restaurant accounting app. Extract the invoice exactly as printed. Return only valid JSON, no markdown. Shape: {"vendor_name":"","invoice_number":"","invoice_date":"YYYY-MM-DD or raw date","due_date":"YYYY-MM-DD or raw date","payment_terms":"","date_ordered":"YYYY-MM-DD or raw date","shipped_date":"YYYY-MM-DD or raw date","invoice_type":"Regular Invoice|Credit Memo|Rebate|Return Credit|Vendor Adjustment","category":"Food|Beverage|Beer|Liquor|Utilities|Insurance|Supplies|Maintenance|Other","sales_subtotal":0,"total_discount":0,"total_charges":0,"net_amount":0,"tax":0,"total":0,"freight":0,"discount":0,"lineItems":[{"description":"","item_number":"","brand":"","ordered_qty":0,"shipped_qty":0,"adjusted_qty":0,"qty":0,"sales_unit":"","unit":"","purchase_unit":"Case|Bottle|Each|Pack|Box|","package_size":"","pricing_unit":"","weight":0,"pack_count":0,"unit_size_value":0,"unit_size_unit":"","unit_price":0,"gross_unit_price":0,"discount_percent":0,"discount_amount":0,"discount_per_unit":0,"net_unit_price":0,"total":0,"category":""}]}.

STRICT TRANSCRIPTION RULE: Every line-item value must come from the SAME PRINTED ROW. Never carry a pack size, quantity, price, unit, or brand from the row above/below. Never invent a pack size from examples or prior invoices. If a printed cell is blank, return blank/0.

US FOODS RULES: When the vendor is US Foods, locate the table headed INVOICE LINE DETAILS. Read these printed columns row-by-row: ORD, SHP, ADJ, SALES UNIT, PRODUCT NUMBER, DESCRIPTION, LABEL, PACK SIZE, CODE, WEIGHT, PRICING UNIT, UNIT PRICE, EXTENDED PRICE. Map them exactly as follows: ordered_qty=ORD; shipped_qty=SHP; adjusted_qty=ADJ; qty=SHP; sales_unit=SALES UNIT; item_number=PRODUCT NUMBER; description=DESCRIPTION; brand=LABEL; package_size=PACK SIZE exactly as printed; weight=WEIGHT; pricing_unit=PRICING UNIT; unit_price=UNIT PRICE; total=EXTENDED PRICE. Map SALES UNIT CS to purchase_unit Case and EA to Each. Do NOT calculate UNIT PRICE from quantity or EXTENDED PRICE. Do NOT calculate EXTENDED PRICE when it is printed. Weighted/catch-weight lines are valid: for a Case sold with PRICING UNIT LB, qty is the number of cases, weight is the printed pounds, unit_price is the per-pound price, and total is the printed extended price. Therefore qty * unit_price is NOT expected to equal total for those rows. Preserve adjustment rows exactly, including a shipped line whose ADJ makes the extended price $0.00.

DATE RULES: invoice_date MUST come from a field explicitly labeled INVOICE DATE. Never use DATE ORDERED, SHIPPED DATE, delivery date, PDF creation time, or signature date as invoice_date. If INVOICE DATE repeats on pages, use the repeated value to validate. Extract payment terms from PAYMENT TERMS and the printed remit/due date when present.

TOTAL RULES: Product Total/sales_subtotal must match the printed invoice summary. Summary savings/allowances/credits are positive total_discount values that are subtracted once. Fuel surcharge/other charges belong in total_charges/freight. Tax is the printed tax. total is the printed final amount due/remit amount and is authoritative. lineItems.total is always the printed EXTENDED PRICE/line amount and must not be recomputed or discounted twice.

ALABAMA ABC RULES: For Alabama Alcoholic Beverage Control / Alabama ABC, read every item row left-to-right from the same printed row. Quantity is the printed case quantity. Unit cs/CS means purchase_unit Case. Unit price is the printed GROSS CASE PRICE. Discount Amount is the printed DISCOUNT PER CASE / purchased unit. The final printed row amount is the authoritative EXTENDED NET LINE TOTAL. Set gross_unit_price=unit_price, discount_per_unit=discount_amount, and net_unit_price=total/qty when qty is greater than zero. Example: 2.00 cs, 167.88 unit price, 23.51 Discount Amount, 288.75 printed line amount means 2 cases, gross case 167.88, discount per case 23.51, net case 144.375, extended 288.75. Never place 288.75 into unit_price. Never treat a net case value such as 386.95 (773.90 / 2) as a bottle price. If bottles-per-case is not printed, leave package_size blank and pack_count 0; do not guess. PACKAGE RULES: purchase_unit is the purchased sales unit, while package_size is the exact printed PACK SIZE cell. Do not infer liquor-style sizes on food invoices. Derive pack_count/unit_size fields only when unambiguous from the exact printed PACK SIZE; otherwise leave 0/blank. Use numbers only for numeric amounts. If unclear, use empty string or 0. File name: ${fileName}`

    const preferredModel = clean(Deno.env.get('GEMINI_MODEL'))
    const models = preferredModel
      ? [preferredModel, ...DEFAULT_MODELS.filter(model => model !== preferredModel)]
      : DEFAULT_MODELS

    let lastError = 'Gemini extraction failed.'
    let lastStatus = 502

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data } }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      })

      if (!response.ok) {
        const rawDetail = await response.text().catch(() => '')
        const providerMessage = safeProviderError(rawDetail)
        lastStatus = response.status
        lastError = `Gemini ${model} failed (${response.status}): ${providerMessage}`
        console.error('gemini-invoice provider error', {
          model,
          status: response.status,
          message: providerMessage,
          fileName,
          mimeType
        })

        const modelSpecificFailure = response.status === 404 || /model.*(?:not found|not supported|unavailable)/i.test(providerMessage)
        if (modelSpecificFailure) continue

        return jsonResponse({
          ok: false,
          code: response.status === 400 ? 'GEMINI_BAD_REQUEST' : response.status === 401 || response.status === 403 ? 'GEMINI_AUTH_ERROR' : 'GEMINI_PROVIDER_ERROR',
          message: lastError,
          providerStatus: response.status,
          model
        }, response.status === 401 || response.status === 403 ? 502 : response.status >= 500 ? 502 : 400)
      }

      const result = await response.json()
      const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('\n') || ''
      if (!text) {
        const blockReason = result?.promptFeedback?.blockReason || result?.candidates?.[0]?.finishReason || 'No text returned'
        lastError = `Gemini ${model} returned no invoice data: ${blockReason}.`
        console.error('gemini-invoice empty response', { model, blockReason, result })
        continue
      }

      try {
        const parsed = JSON.parse(extractJsonText(text))
        return jsonResponse({ ok: true, ...normalizeInvoicePayload(parsed), model })
      } catch (error) {
        lastError = `Gemini ${model} returned invalid JSON.`
        console.error('gemini-invoice invalid JSON', { model, text: text.slice(0, 1200), error })
      }
    }

    return jsonResponse({ ok: false, code: 'GEMINI_EMPTY_OR_INVALID_RESPONSE', message: lastError, providerStatus: lastStatus }, 502)
  } catch (error) {
    console.error('gemini-invoice function error', error)
    return jsonResponse({
      ok: false,
      code: 'UNEXPECTED_OCR_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected OCR error.'
    }, 500)
  }
})
