import { json, verifyGovernmentRecord, type DocumentType } from '../_shared';

export async function onRequestPost({ request }: { request: Request }) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const documentType = body.documentType as DocumentType | undefined;
  const extractedFields = body.extractedFields as Record<string, string> | undefined;

  if (
    (documentType !== 'trade_license' &&
      documentType !== 'vat_certificate' &&
      documentType !== 'bank_document') ||
    !extractedFields
  ) {
    return json({ error: 'Missing documentType or extractedFields arguments.' }, { status: 400 });
  }

  return json(verifyGovernmentRecord(documentType, extractedFields));
}
