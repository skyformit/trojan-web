import { DocumentType, isNotExpired } from "../_shared";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const { documentType, extractedFields } = (await request.json()) as {
      documentType?: string;
      extractedFields?: Record<string, string>;
    };

    if (!documentType || !extractedFields) {
      return json({ error: "Missing documentType or extractedFields arguments." }, 400);
    }

    if (documentType === "trade_license") {
      const licenseNumber = (extractedFields.licenseNumber || "").trim();
      const expiryDate = (extractedFields.expiryDate || "").trim();
      const licensedActivities = (
        extractedFields.licensedActivities ||
        extractedFields.activity ||
        ""
      ).trim();
      const companyName = (extractedFields.companyName || "Verified Trade License").trim();
      const isActive = licenseNumber && expiryDate && licensedActivities && isNotExpired(expiryDate);

      if (isActive) {
        return json({
          status: "success",
          matched: true,
          registeredName: companyName,
          registryStatus: "ACTIVE",
          details:
            `Validated trade license from OCR fields. License No: ${licenseNumber}. ` +
            `Expiry: ${expiryDate}. Licensed Activities: ${licensedActivities}.`,
          registryRecord: {
            companyName,
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: expiryDate,
            licensedActivities,
          },
        });
      }

      return json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: !licenseNumber || !expiryDate || !licensedActivities
          ? "Trade license is missing required OCR fields. Please review license number, expiry date, and licensed activities."
          : `Trade license expired on ${expiryDate}. Please upload a valid license with a future expiry date.`,
      });
    }

    if (documentType === "vat_certificate") {
      const vatNumber = (extractedFields.vatNumber || "").trim();
      const companyName = (extractedFields.companyName || "").trim();

      if (vatNumber && companyName) {
        return json({
          status: "success",
          matched: true,
          registeredName: companyName || "Verified VAT Certificate",
          registryStatus: "ACTIVE",
          details: `Validated VAT certificate from OCR fields. VAT No: ${vatNumber}.`,
          registryRecord: {
            companyName: companyName || "Verified VAT Certificate",
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: extractedFields.registrationDate || "N/A",
          },
        });
      }

      return json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: "VAT certificate is missing the VAT number or company name OCR field.",
      });
    }

    if (documentType === "bank_document") {
      const companyName = (extractedFields.companyName || "").trim();

      if (companyName) {
        return json({
          status: "success",
          matched: true,
          registeredName: companyName || "Verified Bank Document",
          registryStatus: "ACTIVE",
          details: `Validated bank document from OCR fields. Company Name: ${companyName}.`,
          registryRecord: {
            companyName: companyName || "Verified Bank Document",
            postalAddress: "Document-Only Validation",
            signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
            licenseExpiry: "N/A",
          },
        });
      }

      return json({
        status: "success",
        matched: false,
        registryStatus: "NOT_FOUND",
        details: "Bank document is missing the company name OCR field.",
      });
    }

    return json({
      status: "error",
      message: "Unsupported documentType parameter.",
    }, 400);
  } catch (error: any) {
    return json(
      {
        status: "error",
        message: error.message || "Internal server error during verification",
      },
      500
    );
  }
}
