import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, Dispatch, SetStateAction } from 'react';
import { streamChatMessage } from '../utils/chatStream';
import { validateGuidedCompanyName } from '../config/guidedOnboarding';
import {
  composeUaeMobileNumber,
  getContextCompanyName,
  getFirstTbmsVendor,
  getNextStepFromResponse,
  getStructuredSource,
  getTbmsVendors,
  getUploadTypeForStep,
  getVendorDisplayName,
  getVendorLifecycleStatus,
  getVendorRouteLabel,
  getWorkflowStateFromResponse,
  shouldShowContactForm,
  hasCompleteContactInfo,
  hasContactConfirmationMessage,
  stabilizeWorkflowState,
  validateContactInfo,
  splitUaeMobileNumber,
  UAE_MOBILE_PREFIX_OPTIONS,
  type ContactValidationErrors,
  type GeneralBotResponse,
  type VendorLookupSummary,
} from '../utils/chatWorkflow';
import type { ChatMessage, SupplierRegistrationState } from '../types';

export interface AIAgentChatControllerProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: Dispatch<SetStateAction<SupplierRegistrationState>>;
  onAnalyzeDocument: (
    type: 'trade_license' | 'vat_certificate' | 'bank_document',
    file: File | null,
    isPresetSample?: { companyName: string },
    uploadContext?: {
      companyName?: string;
      conversationId?: string | null;
      tradeLicenseNumber?: string;
      documentContext?: Record<string, unknown> | string | null;
      contextHint?: Record<string, unknown> | string | null;
    }
  ) => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: Dispatch<SetStateAction<ChatMessage[]>>;
}

export function useAIAgentChatController({
  registrationState,
  setRegistrationState,
  onAnalyzeDocument,
  chatHistory,
  setChatHistory,
}: AIAgentChatControllerProps) {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<'trade_license' | 'vat_certificate' | 'bank_document' | null>('trade_license');
  const [contactValidationAttempted, setContactValidationAttempted] = useState(false);
  const [contactErrors, setContactErrors] = useState<ContactValidationErrors>({});
  const [uaePhonePrefix, setUaePhonePrefix] = useState<'50' | '51' | '52' | '53' | '54' | '55' | '56' | '57' | '58' | '59'>('50');
  const [uaePhoneLocalNumber, setUaePhoneLocalNumber] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [vendorLookupSummary, setVendorLookupSummary] = useState<VendorLookupSummary[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastConversationContextRef = useRef<GeneralBotResponse['context'] | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

  const uploadTypeForCurrentStep = getUploadTypeForStep(registrationState.currentStep);

  const scrollMessagesToLatest = (behavior: ScrollBehavior = 'auto') => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      const nextContainer = messagesContainerRef.current;
      if (!nextContainer) return;

      nextContainer.scrollTo({
        top: nextContainer.scrollHeight,
        behavior,
      });
    });
  };

  useEffect(() => {
    const latestMessage = chatHistory[chatHistory.length - 1];
    const shouldSmoothScroll = latestMessage?.sender === 'agent' || latestMessage?.sender === 'system';
    scrollMessagesToLatest(shouldSmoothScroll ? 'smooth' : 'auto');

    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [chatHistory, isRequestInProgress, vendorLookupSummary, registrationState.currentStep, registrationState.workflowRoute]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      setConversationId(null);
      setVendorLookupSummary([]);
      lastConversationContextRef.current = null;
    }
  }, [chatHistory.length]);

  useEffect(() => {
    if (registrationState.currentStep === 'initial') {
      setActiveUploadType(null);
    } else if (registrationState.currentStep === 'trade_license_upload') {
      setActiveUploadType('trade_license');
    } else if (registrationState.currentStep === 'vat_upload') {
      setActiveUploadType('vat_certificate');
    } else if (registrationState.currentStep === 'bank_document_upload') {
      setActiveUploadType('bank_document');
    } else {
      setActiveUploadType(null);
    }
  }, [registrationState.currentStep]);

  useEffect(() => {
    if (!contactValidationAttempted) {
      return;
    }

    setContactErrors(
      validateContactInfo(
        registrationState.contactName,
        registrationState.contactEmail,
        registrationState.phoneNumber
      )
    );
  }, [
    contactValidationAttempted,
    registrationState.contactName,
    registrationState.contactEmail,
    registrationState.phoneNumber
  ]);

  useEffect(() => {
    const { prefix, localNumber } = splitUaeMobileNumber(registrationState.phoneNumber);
    setUaePhonePrefix(prefix as typeof uaePhonePrefix);
    setUaePhoneLocalNumber(localNumber);
  }, [registrationState.phoneNumber]);

  useEffect(() => {
    if (
      registrationState.currentStep === 'contact_info' &&
      hasCompleteContactInfo(registrationState) &&
      hasContactConfirmationMessage(chatHistory)
    ) {
      setRegistrationState(prev => ({
        ...prev,
        currentStep: 'trade_license_upload'
      }));
    }
  }, [chatHistory, registrationState, setRegistrationState]);

  const processAgentResponse = async (userText: string) => {
    setIsRequestInProgress(true);

    try {
      const response = await fetch('/api/invoke-general-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          message: userText,
          prompt: userText,
          intent: 'general_chat',
          conversation_id: conversationId,
          context: lastConversationContextRef.current || undefined
        })
      });

      const data = (await response.json()) as GeneralBotResponse;
      const isServerError =
        !response.ok ||
        data.ok === false ||
        data.error?.code === 'response_parse_error' ||
        data.status === 'error';

      if (isServerError) {
        setRegistrationState(prev => ({
          ...prev,
          currentStep: 'initial'
        }));

        await streamChatMessage(
          setChatHistory,
          `The server is temporarily unavailable. Please try again in a moment.`,
          {
            onFirstChunk: () => setIsRequestInProgress(false)
          }
        );
        return;
      }

      const workflowState = getWorkflowStateFromResponse(data);
      const responseText = data.text || 'No response text returned from the workflow router.';
      const vendorName = getVendorDisplayName(data);
      const contextCompanyName = getContextCompanyName(data);
      const tbmsVendor = getFirstTbmsVendor(data);
      const showContactForm = shouldShowContactForm(data);
      const tbmsLifecycleStatus = tbmsVendor
        ? getVendorLifecycleStatus(
            String(tbmsVendor.expDate || ''),
            String(tbmsVendor.approvalStatus || '')
          )
        : null;
      const finalWorkflowRoute = tbmsLifecycleStatus
        ? tbmsLifecycleStatus === 'renewal_due'
          ? 'renewal'
          : tbmsLifecycleStatus === 'expired'
            ? 'vendor'
            : 'vendor'
        : workflowState.workflowRoute;
      const finalWorkflowStatus = tbmsLifecycleStatus
        ? tbmsLifecycleStatus
        : workflowState.workflowStatus;

      const shouldOpenContactPanel = showContactForm || (!tbmsVendor && finalWorkflowRoute !== 'general');

      setRegistrationState(prev => {
        const validVendorName = validateGuidedCompanyName(vendorName).valid ? vendorName : '';
        const validUserCompanyName = validateGuidedCompanyName(userText).valid ? userText : '';
        const nextStep = getNextStepFromResponse(data, prev.currentStep);

        return {
          ...prev,
          ...stabilizeWorkflowState(prev, {
            workflowRoute: finalWorkflowRoute,
            workflowStatus: finalWorkflowStatus,
            workflowName: tbmsLifecycleStatus
              ? tbmsLifecycleStatus === 'renewal_due'
                ? 'Renewal-Vendor-Approval-Workflow'
                : 'TCG-Vendor-Approval-Workflow'
              : workflowState.workflowName,
            workflowApiPath: tbmsLifecycleStatus
              ? tbmsLifecycleStatus === 'renewal_due'
                ? '/api/renewal-vendor-approval-workflow'
                : '/api/vendor-approval-workflow'
              : workflowState.workflowApiPath,
          }),
          companyName: contextCompanyName || prev.companyName || validVendorName || validUserCompanyName,
          currentStep: nextStep
        };
      });

      if (tbmsVendor) {
        const tbmsVendors = getTbmsVendors(data);
        setVendorLookupSummary(tbmsVendors.map((vendor: any) => {
          const lifecycleStatus = tbmsLifecycleStatus || getVendorLifecycleStatus(
            String(vendor.expDate || ''),
            String(vendor.approvalStatus || '')
          );

          return {
            companyName: String(vendor.vendName || vendorName || userText).trim(),
            tradeLicenseNo: String(vendor.tradeLicenseNo || 'N/A'),
            approvalStatus: String(vendor.approvalStatus || 'N/A'),
            lifecycleStatus,
            routeLabel: getVendorRouteLabel(lifecycleStatus),
            expDate: String(vendor.expDate || 'N/A'),
            issueAuthority: String(vendor.issueAuthority || 'N/A'),
            address: String(vendor.address || 'N/A').replace(/\r?\n/g, ', '),
            phone: String(vendor.tel || 'N/A'),
            email: String(vendor.email || 'N/A').replace(/\.$/, ''),
            website: String(vendor.website || 'N/A'),
            chamberNo: String(vendor.chamberNo || 'N/A'),
            businessActivity: String(vendor.tradeActivities || 'N/A'),
          };
        }));
      } else if (getStructuredSource(data) === 'tbms') {
        setVendorLookupSummary([]);
      } else {
        setVendorLookupSummary([]);
      }

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      if (data.context) {
        lastConversationContextRef.current = data.context;
      }

      if (!tbmsVendor) {
        await streamChatMessage(
          setChatHistory,
          getStructuredSource(data) === 'tbms'
            ? `No vendor match found. Please enter the contact details below to continue.`
            : responseText,
          {
            onFirstChunk: () => setIsRequestInProgress(false)
          }
        );
      }

      if (showContactForm || (!tbmsVendor && getStructuredSource(data) === 'tbms')) {
        setRegistrationState(prev => ({
          ...prev,
          currentStep: 'contact_info'
        }));
      }
    } catch (error: any) {
      await streamChatMessage(
        setChatHistory,
        `The server is temporarily unavailable. Please try again in a moment.`,
        {
          onFirstChunk: () => setIsRequestInProgress(false)
        }
      );
    } finally {
      setIsRequestInProgress(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (showContactSetup) {
      setInputText('');
      return;
    }

    if (!textToSend) {
      setInputText('');
    }

    const userMsgId = 'user-' + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, newUserMessage]);
    scrollMessagesToLatest();

    setTimeout(() => {
      processAgentResponse(text);
    }, 800);
  };

  const handleSaveContactInfo = () => {
    setContactValidationAttempted(true);

    const validationErrors = validateContactInfo(
      registrationState.contactName,
      registrationState.contactEmail,
      registrationState.phoneNumber
    );

    setContactErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const cName = registrationState.contactName.trim();
    const cEmail = registrationState.contactEmail.trim();
    const cPhone = registrationState.phoneNumber.trim();

    setChatHistory(prev => [
      ...prev,
      {
        id: 'contact-submit-' + Date.now(),
        sender: 'user',
        text: `Full Name: ${cName}\nEmail: ${cEmail}\nMobile: ${cPhone}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    scrollMessagesToLatest();

    setTimeout(async () => {
      setRegistrationState(prev => ({
        ...prev,
        contactName: cName,
        contactEmail: cEmail,
        phoneNumber: cPhone,
        currentStep: 'trade_license_upload'
      }));

      setContactValidationAttempted(false);
      setContactErrors({});

      await streamChatMessage(
        setChatHistory,
        `[[CONTACT_SUMMARY]]
Recipient Name: ${cName}
Email: ${cEmail}
SMS: ${cPhone}
Next Step: Please upload or drop your Valid Trade License (PDF) to proceed.
We will verify your company's credentials after the upload.`
      );
    }, 850);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = input.files;
    if (!files || files.length === 0 || !uploadTypeForCurrentStep) return;

    const selectedFile = files[0];
    input.value = '';
    await processFileUpload(selectedFile, uploadTypeForCurrentStep);
  };

  const processFileUpload = async (file: File, type: 'trade_license' | 'vat_certificate' | 'bank_document') => {
    setIsUploading(true);
    const documentLabel =
      type === 'trade_license'
        ? 'trade license'
        : type === 'vat_certificate'
          ? 'VAT certificate'
          : 'bank document';

    const logId = 'upload-' + Date.now();
    setChatHistory(prev => [...prev, {
      id: logId,
      sender: 'system',
      text: `Getting your ${documentLabel} ready for review...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    scrollMessagesToLatest();

    try {
      setChatHistory(prev => [...prev, {
        id: 'upload-start-' + Date.now(),
        sender: 'system',
        text: `We have received your ${documentLabel}. Starting the review now...`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      scrollMessagesToLatest();

      await onAnalyzeDocument(
        type,
        file,
        registrationState.companyName ? { companyName: registrationState.companyName } : undefined,
        {
          companyName: registrationState.companyName || undefined,
          conversationId,
          tradeLicenseNumber: registrationState.tradeLicenseNumber || '',
          documentContext: {
            documentType: type,
            currentStep: registrationState.currentStep,
            workflowRoute: registrationState.workflowRoute,
            workflowName: registrationState.workflowName,
          },
          contextHint: lastConversationContextRef.current || undefined,
        }
      );
    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => [...prev, {
        id: 'error-' + Date.now(),
        sender: 'agent',
        text: `Error uploading document: ${err.message || 'File processing failed'}. Please retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!uploadTypeForCurrentStep) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileUpload(e.dataTransfer.files[0], uploadTypeForCurrentStep);
    }
  };

  const getStepIndicator = () => {
    if (registrationState.currentStep === 'initial') return 'Step 1: Account Identification';
    if (registrationState.currentStep === 'contact_info') return 'Step 2: Notification Setup';
    if (registrationState.currentStep === 'trade_license_upload') return 'Step 3: Trade License Audit';
    if (registrationState.currentStep === 'vat_upload') return 'Step 4: VAT Compliance Audit';
    if (registrationState.currentStep === 'bank_document_upload') return 'Step 5: Bank Account Clearance';
    if (registrationState.currentStep === 'review') return 'Step 6: Compliance Scores';
    if (registrationState.workflowRoute === 'vendor') return 'Workflow: Vendor Approval';
    if (registrationState.workflowRoute === 'renewal') return 'Workflow: Renewal Approval';
    if (registrationState.workflowRoute === 'general') return 'Workflow: General Bot';
    return 'Workflow: Awaiting Input';
  };

  const showContactSetup =
    registrationState.currentStep === 'contact_info' &&
    !isRequestInProgress &&
    (!hasCompleteContactInfo(registrationState) || !hasContactConfirmationMessage(chatHistory));

  return {
    inputText,
    setInputText,
    isUploading,
    isRequestInProgress,
    contactValidationAttempted,
    contactErrors,
    uaePhonePrefix,
    uaePhoneLocalNumber,
    conversationId,
    vendorLookupSummary,
    messagesContainerRef,
    fileInputRef,
    dragActive,
    setDragActive,
    uploadTypeForCurrentStep,
    showContactSetup,
    getStepIndicator,
    handleSendMessage,
    handleSaveContactInfo,
    handleFileChange,
    handleDrag,
    handleDrop,
    setRegistrationState,
    setUaePhonePrefix,
    setUaePhoneLocalNumber,
    setContactValidationAttempted,
    setContactErrors,
    setVendorLookupSummary,
    setConversationId,
    setIsUploading,
    setIsRequestInProgress,
  } as const;
}
