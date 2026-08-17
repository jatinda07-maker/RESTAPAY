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
      qty: Number(item?.qty || 0),
      unit: clean(item?.unit),
      purchase_unit: clean(item?.purchase_unit || item?.unit),
      package_size: clean(item?.package_size),
      pack_count: Number(item?.pack_count || 0),
      unit_size_value: Number(item?.unit_size_value || 0),
      unit_size_unit: clean(item?.unit_size_unit),
      unit_price: Number(item?.unit_price || 0),
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

    const prompt = `You are an invoice extraction and reconciliation engine for a restaurant accounting app. Extract invoice data from this file/image/PDF. Return only valid JSON, no markdown. Shape: {"vendor_name":"","invoice_number":"","invoice_date":"YYYY-MM-DD or raw date","invoice_type":"Regular Invoice|Credit Memo|Rebate|Return Credit|Vendor Adjustment","category":"Food|Beverage|Beer|Liquor|Utilities|Insurance|Supplies|Maintenance|Other","product_total":0,"sales_subtotal":0,"fuel_surcharge":0,"other_charges":0,"total_charges":0,"total_discount":0,"total_allowance_adjustment":0,"delivered_amount":0,"net_amount":0,"tax":0,"remit_amount":0,"total":0,"freight":0,"discount":0,"lineItems":[{"description":"","item_number":"","brand":"","qty":0,"unit":"","purchase_unit":"Case|Bottle|Each|Pack|Box|","package_size":"","pack_count":0,"unit_size_value":0,"unit_size_unit":"","unit_price":0,"discount_percent":0,"discount_amount":0,"total":0,"category":""}]}. RECONCILIATION RULES: product_total is the printed merchandise/Product Total before invoice-level fuel/freight/service charges and tax. sales_subtotal may mirror product_total only when the invoice calls it subtotal. fuel_surcharge is only the printed fuel surcharge. other_charges contains other invoice-level non-tax charges. total_charges equals fuel_surcharge + other_charges and must never include tax or merchandise line amounts. total_discount / total_allowance_adjustment are invoice-summary reductions only. delivered_amount/net_amount are printed intermediate summary values if present. remit_amount/total are the final printed amount due/remit and are authoritative. The expected final math is product_total + total_charges + tax - total_discount/allowance = final total. lineItems.total must be the PRINTED line Amount/extended amount after any line-level discount. Never subtract a printed line discount from that line total again and never create a fake line item for fuel surcharge, tax, summary discount, or invoice adjustment. For US Foods/PFG/Sysco specifically, read the INVOICE SUMMARY and DELIVERY SUMMARY separately and do not confuse gross/net shipped weight with dollars. For all vendors, distinguish PURCHASE UNIT from package size. purchase_unit must be Case, Bottle, Each, Pack, Box, or empty when unclear. A line sold as CS/case is Case even when package_size is 6/750 ML. A line sold as BT/BTL/bottle is Bottle. Extract pack/case details exactly when printed. Never copy a package size from a neighboring line. Sanity-check package units against the item description; for example a tortilla chip line must not inherit a liquor-style 6/750 ML package. If pack/size is unclear, leave it blank and pack_count 0 rather than guessing. Use numbers only for amounts. If a field is unclear, use empty string or 0. File name: ${fileName}`

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
