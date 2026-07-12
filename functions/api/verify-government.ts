function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function getBestCompanyName(extractedFields: Record<string, string>) {
  return (
    extractedFields.companyName ||
    extractedFields.businessName ||
    extractedFields.operatingName ||
    extractedFields.legalNameEnglish ||
    extractedFields.tradeName ||
    "Verified Document"
  ).trim();
}

export async function onRequestPost({ request }: { request: Request }) {
  try {
    const { documentType, extractedFields } = (await request.json()) as {
      documentType?: string;
      extractedFields?: Record<string, string>;
      enteredCompanyName?: string;
    };

    if (!documentType || !extractedFields) {
      return json({ error: "Missing documentType or extractedFields arguments." }, 400);
    }

    const companyName = getBestCompanyName(extractedFields);

    if (documentType === "trade_license") {
      return json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "Trade license data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: extractedFields.expiryDate || "N/A",
          licensedActivities: extractedFields.licensedActivities || extractedFields.activity || "N/A",
        },
      });
    }

    if (documentType === "vat_certificate") {
      return json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "VAT document data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: extractedFields.registrationDate || "N/A",
        },
      });
    }

    if (documentType === "bank_document") {
      return json({
        status: "success",
        matched: true,
        registeredName: companyName,
        registryStatus: "ACTIVE",
        details: "Bank document data received from Azure backend response.",
        registryRecord: {
          companyName,
          postalAddress: extractedFields.address || "Document-Only Validation",
          signatory: extractedFields.manager || extractedFields.authorizedSignatory || "N/A",
          licenseExpiry: "N/A",
        },
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
