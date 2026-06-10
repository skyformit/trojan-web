import { json, getMockExtractedData, type DocumentType } from '../_shared';

export async function onRequestPost({ request }: { request: Request }) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const documentType = body.documentType as DocumentType | undefined;

  if (
    documentType !== 'trade_license' &&
    documentType !== 'vat_certificate' &&
    documentType !== 'bank_document'
  ) {
    return json({ status: 'error', message: 'Invalid or missing documentType.' }, { status: 400 });
  }

  await new Promise(resolve => setTimeout(resolve, 1800));

  return json({
    status: 'success',
    ocrSource: 'fallback_simulation',
    note: 'Cloudflare Pages Function processed the document through the sandbox fallback path.',
    extractedData: getMockExtractedData(documentType)
  });
}

