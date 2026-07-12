import React from 'react';
import { Send, CheckCircle2, ShieldAlert, RefreshCw, Sparkles, Paperclip, Mic } from 'lucide-react';
import { ChatMessage, SupplierRegistrationState } from '../types';
import { composeUaeMobileNumber, getVendorBadgeLabel, UAE_MOBILE_PREFIX_OPTIONS } from '../utils/chatWorkflow';
import { useAIAgentChatController } from '../hooks/useAIAgentChatController';
import ChatMessageBubble from './ui/ChatMessageBubble';
import ContactSetupCard from './ui/ContactSetupCard';
import ProcessingIndicator from './ui/ProcessingIndicator';
import UploadDropZone from './ui/UploadDropZone';
import VendorLookupResults from './ui/VendorLookupResults';

interface AIAgentChatProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onConversationIdChange?: (conversationId: string | null) => void;
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
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export default function AIAgentChat({
  registrationState,
  setRegistrationState,
  onConversationIdChange,
  onAnalyzeDocument,
  chatHistory,
  setChatHistory,
}: AIAgentChatProps) {
  const {
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
    chatEndRef,
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
    setUaePhonePrefix,
    setUaePhoneLocalNumber,
  } = useAIAgentChatController({
    registrationState,
    setRegistrationState,
    onAnalyzeDocument,
    chatHistory,
    setChatHistory,
  });

  React.useEffect(() => {
    onConversationIdChange?.(conversationId);
  }, [conversationId, onConversationIdChange]);

  const effectiveUploadType = uploadTypeForCurrentStep;

  const renderFormattedText = (text: string, tone: 'agent' | 'user' = 'agent') => {
    const normalizedText = text.replace(/\r\n/g, '\n').trim();
    const bodyClass = tone === 'user' ? 'text-white' : 'text-[var(--brand-primary-deep)]';

    const renderInlineSegments = (value: string) => {
      const parts = value.split(/(\[\[accent\]\][\s\S]+?\[\[\/accent\]\]|\*\*[^*]+\*\*)/g);

      return parts.map((part, index) => {
        if (part.startsWith('[[accent]]') && part.endsWith('[[/accent]]') && part.length > '[[accent]][[/accent]]'.length) {
          return (
              <span key={`${index}-${part}`} className={`font-semibold ${tone === 'user' ? 'text-white' : 'text-[var(--brand-sky-light)]'}`}>
              {part.slice('[[accent]]'.length, -'[[/accent]]'.length)}
            </span>
          );
        }

        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={`${index}-${part}`} className={`font-semibold ${tone === 'user' ? 'text-white' : 'text-[var(--brand-primary-deep)]'}`}>
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>;
      });
    };

    const renderParagraph = (value: string, key: string) => (
      <p key={key} className={`text-[13px] leading-[1.48] ${bodyClass}`}>
        {renderInlineSegments(value)}
      </p>
    );

    const renderStep = (line: string, key: string) => {
      const stepMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (!stepMatch) return null;

      const [, stepNumber, stepText] = stepMatch;
      return (
        <div key={key} className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[11px] bg-[var(--brand-sky)] text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(0,142,185,0.22)] ring-4 ring-[color:rgba(0,142,185,0.12)]">
              {stepNumber}
            </span>
          <div className={`min-w-0 flex-1 text-[13px] leading-[1.35] ${bodyClass}`}>
            {renderInlineSegments(stepText)}
          </div>
        </div>
      );
    };

    const renderBullet = (line: string, key: string) => {
      const bulletMatch = line.match(/^[-•]\s*(.+)$/);
      if (!bulletMatch) return null;

      return (
        <div key={key} className="flex items-start gap-2 pl-1">
          <span className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-sky)]" />
          <div className={`min-w-0 flex-1 text-[13px] leading-[1.48] ${bodyClass}`}>
            {renderInlineSegments(bulletMatch[1])}
          </div>
        </div>
      );
    };

    const renderTextBlocks = (value: string) => {
      const sections = value
        .split(/\n\s*\n+/g)
        .map(section => section.trim())
        .filter(Boolean);

      return (
      <div className="space-y-2">
          {sections.map((section, sectionIndex) => {
            const lines = section
              .split(/\n/g)
              .map(line => line.trim())
              .filter(Boolean);

            if (lines.length === 0) return null;

            const hasNumberedItems = lines.some(line => /^\d+\.\s*/.test(line));
            const hasBullets = lines.some(line => /^[-•]\s*/.test(line));

            if (hasNumberedItems) {
              return (
                <div key={`section-${sectionIndex}`} className="space-y-1.5">
                  {lines.map((line, lineIndex) => renderStep(line, `step-${sectionIndex}-${lineIndex}`) || renderParagraph(line, `para-${sectionIndex}-${lineIndex}`))}
                </div>
              );
            }

            if (hasBullets) {
              return (
                <div key={`section-${sectionIndex}`} className="space-y-1">
                  {lines.map((line, lineIndex) => renderBullet(line, `bullet-${sectionIndex}-${lineIndex}`) || renderParagraph(line, `para-${sectionIndex}-${lineIndex}`))}
                </div>
              );
            }

            if (lines.length === 1) {
              return renderParagraph(lines[0], `para-${sectionIndex}`);
            }

            return (
              <div key={`section-${sectionIndex}`} className="space-y-1">
                {lines.map((line, lineIndex) => renderParagraph(line, `para-${sectionIndex}-${lineIndex}`))}
              </div>
            );
          })}
        </div>
      );
    };

    const parseLabelValueRows = (body: string) => {
      const rows = body
        .trim()
        .split(/\n/g)
        .map(line => line.trim())
        .filter(Boolean);

      return rows.reduce<Record<string, string>>((acc, line) => {
        const [label, ...valueParts] = line.split(':');
        if (!label || valueParts.length === 0) return acc;
        acc[label.trim()] = valueParts.join(':').trim();
        return acc;
      }, {});
    };

    if (
      tone === 'agent' &&
      normalizedText.startsWith('Hello and welcome to the [[accent]]Secure Supplier Portal!') &&
      normalizedText.includes('three vital company certificates in real-time:')
    ) {
      const listItems = [
        'Valid Trade License',
        'VAT Registration Certificate',
        'Official Bank Document (Account ownership statement)',
      ];

      return (
        <div className="w-full max-w-none space-y-3.5 pr-2">
          <p className="text-[14px] leading-[1.42] text-[var(--brand-neutral)]">
            Hello and welcome to the <span className="font-semibold text-[var(--brand-sky)]">Secure Supplier Portal!</span> 💎
          </p>

          <p className="w-full text-[14px] leading-[1.42] text-[var(--brand-neutral)]">
            I am your AI Onboarding Assistant. I am here to guide you step-by-step through our supplier registration program. To align with corporate and compliance standards, we require authentication of{' '}
            <strong className="font-semibold text-[var(--brand-primary-deep)]">three vital company certificates</strong>{' '}
            in real-time:
          </p>

          <div className="space-y-1.5 pt-0.5">
            {listItems.map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[12px] bg-[var(--brand-sky)] text-[13px] font-black text-white shadow-[0_10px_18px_rgba(0,142,185,0.18)] ring-4 ring-[color:rgba(0,142,185,0.10)]">
                  {index + 1}
                </span>
                <p className="max-w-[44ch] text-[14px] font-semibold leading-[1.32] text-[var(--brand-primary-deep)]">
                  {item}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[14px] leading-[1.42] text-[var(--brand-neutral)]">
            Let&apos;s begin!{' '}
            <span className="font-semibold text-[var(--brand-sky)]">
              What is the registered Commercial Name of your Enterprise?
            </span>
          </p>
        </div>
      );
    }

    if (normalizedText.startsWith('[[DOCUMENT_REVIEW]]')) {
      const rowMap = parseLabelValueRows(normalizedText.replace('[[DOCUMENT_REVIEW]]', ''));
      const orderedEntries = Object.entries(rowMap).filter(([label]) => label !== 'Next Step');

      return (
        <div className="space-y-3">
          <div className="font-bold text-amber-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            <span>Document Sent for Review</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
            <div className="grid grid-cols-2 bg-amber-100 text-[10px] uppercase tracking-widest text-amber-700 font-bold border-b border-amber-200">
              <div className="px-3 py-2 border-r border-amber-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {(orderedEntries.length > 0 ? orderedEntries : [['Review Note', rowMap['Review Note'] || 'The document needs a quick review before approval.']]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-amber-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-amber-900 bg-amber-50 border-r border-amber-100">{label}</div>
                <div className="px-3 py-2 text-slate-800 break-words bg-amber-50">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-amber-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'We will continue once the review is complete.'}
          </div>
        </div>
      );
    }

    if (normalizedText.startsWith('[[DOCUMENT_REJECTED]]')) {
      const rowMap = parseLabelValueRows(normalizedText.replace('[[DOCUMENT_REJECTED]]', ''));
      const rejectionSummary = rowMap['Rejection Summary'] || rowMap['Reason'] || 'This document could not be approved.';
      const normalizedSummary = rejectionSummary.toLowerCase();
      const rejectionLabel = normalizedSummary.includes('expired')
        ? 'Document Expired'
        : normalizedSummary.includes('company name mismatch') || normalizedSummary.includes('does not match')
          ? 'Company Name Mismatch'
          : normalizedSummary.includes('document type')
            ? 'Incorrect Document Type'
            : 'Verification Failed';
      const orderedEntries = Object.entries(rowMap).filter(([label]) => label !== 'Next Step');

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Document Rejected</span>
            <span className="text-[10px] uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">{rejectionLabel}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {(orderedEntries.length > 0 ? orderedEntries : [['Rejection Summary', rejectionSummary]]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">{label}</div>
                <div className="px-3 py-2 text-slate-800 break-words">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-rose-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please upload a corrected document to continue.'}
          </div>
        </div>
      );
    }

    if (normalizedText.startsWith('[[DOCUMENT_EXPIRED]]')) {
      const rowMap = parseLabelValueRows(normalizedText.replace('[[DOCUMENT_EXPIRED]]', ''));
      const orderedEntries = Object.entries(rowMap).filter(([label]) => label !== 'Next Step');

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Document Expired</span>
            <span className="text-[10px] uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Expired</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {(orderedEntries.length > 0 ? orderedEntries : [['Expiration Summary', 'The uploaded document appears to be expired.']]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">{label}</div>
                <div className="px-3 py-2 text-slate-800 break-words">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-slate-800">
            <span className="font-bold text-amber-700">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please upload a current document with a valid expiry date to continue.'}
          </div>
        </div>
      );
    }

    if (normalizedText.startsWith('[[DOCUMENT_ACCEPTED]]')) {
      const rowMap = parseLabelValueRows(normalizedText.replace('[[DOCUMENT_ACCEPTED]]', ''));
      const orderedEntries = Object.entries(rowMap).filter(([label]) => label !== 'Next Step');

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)]" />
            <span>Document Accepted</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {(orderedEntries.length > 0 ? orderedEntries : [['Acceptance Status', 'Approved']]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">{label}</div>
                <div className="px-3 py-2 text-slate-800 break-words">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-[color:rgba(44,53,97,0.06)] border border-[color:rgba(44,53,97,0.14)] px-3 py-2 text-xs text-[var(--brand-primary-deep)]">
            <span className="font-bold text-[var(--brand-primary)]">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please continue with the next onboarding step.'}
          </div>
        </div>
      );
    }

    if (normalizedText.startsWith('[[CONTACT_SUMMARY]]')) {
      const rowMap = parseLabelValueRows(normalizedText.replace('[[CONTACT_SUMMARY]]', ''));
      const rows = normalizedText.replace('[[CONTACT_SUMMARY]]', '').trim().split(/\n/g).map(line => line.trim()).filter(Boolean);

      return (
        <div className="space-y-3">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--brand-sky)]" />
            <span>Contact Details Registered</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-2 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200">
              <div className="px-3 py-2 border-r border-slate-200">Field</div>
              <div className="px-3 py-2">Value</div>
            </div>

            {[
              ['Recipient Name', rowMap['Recipient Name'] || 'N/A'],
              ['Email', rowMap['Email'] || 'N/A'],
              ['SMS', rowMap['SMS'] || 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 text-xs border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-2 font-semibold text-slate-600 bg-slate-50 border-r border-slate-100">{label}</div>
                <div className="px-3 py-2 text-slate-800 break-words">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-[color:rgba(44,53,97,0.06)] border border-[color:rgba(44,53,97,0.14)] px-3 py-2 text-xs text-[var(--brand-primary-deep)]">
            <span className="font-bold text-[var(--brand-primary)]">Next Step:</span>{' '}
            {rowMap['Next Step'] || 'Please upload or drop your Valid Trade License (PDF) to proceed.'}
            <div className="mt-1 text-[11px] text-slate-600">
              {rows.find(line => line.startsWith('We will verify')) || "We will verify your company's credentials after the upload."}
            </div>
          </div>
        </div>
      );
    }

    return renderTextBlocks(normalizedText);
  };
  return (
    <div className="relative flex h-[min(600px,calc(100dvh-14rem))] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,255,0.98)_0%,rgba(245,248,255,0.96)_22%,rgba(241,246,255,0.92)_100%)] shadow-[0_20px_54px_rgba(15,23,42,0.10)] md:h-[600px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] rounded-r-full bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-sky)] to-[var(--brand-sky-accent)] shadow-[0_0_0_1px_rgba(44,53,97,0.04)] md:h-[3px]" />

      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[color:rgba(213,221,232,0.95)] bg-white/95 px-5 py-2 md:px-6 md:py-2.5">
        <div className="flex items-center gap-3 md:gap-3.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary-mid)] to-[var(--brand-sky)] text-white shadow-[0_12px_22px_rgba(44,53,97,0.22)] ring-4 ring-[color:rgba(44,53,97,0.05)] md:h-11 md:w-11 md:rounded-[14px]">
            <Sparkles className="h-[13px] w-[13px] md:h-[15px] md:w-[15px]" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-[2px] border-white bg-[var(--brand-success)] shadow-[0_0_0_2px_rgba(25,184,107,0.08)]" />
          </div>
          <div>
            <h2 className="text-[16px] font-black tracking-tight text-[var(--brand-primary-deep)] md:text-[18px]">
              Onboarding Officer <span className="font-semibold text-[var(--brand-neutral)]">(AI Agent)</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--brand-neutral)] md:text-[11px]">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-sky)] shadow-[0_0_0_4px_rgba(0,142,185,0.12)]" />
              <span>Real-Time Verification · Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-2.5">
          <span className="rounded-full bg-[linear-gradient(90deg,var(--brand-primary)_0%,var(--brand-primary-mid)_56%,var(--brand-sky)_100%)] px-5 py-3 text-[9px] font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_24px_rgba(44,53,97,0.22)] md:px-7 md:py-3.5 md:text-[10px] md:tracking-[0.34em]">
            {getStepIndicator().replace(/^Step\s+(\d+):\s*/i, 'STEP $1 · ')}
          </span>
        </div>
      </div>

      {/* Messages Scroll Frame */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-1.5 space-y-1 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_32%),radial-gradient(circle_at_12%_55%,_rgba(99,102,241,0.12),_transparent_22%),radial-gradient(circle_at_86%_12%,_rgba(125,211,252,0.06),_transparent_18%),linear-gradient(180deg,_rgba(250,252,255,0.98),_rgba(243,247,255,0.96))]">
        {chatHistory.map((msg) => (
          <React.Fragment key={msg.id}>
            <ChatMessageBubble
              message={msg}
              isUploading={isUploading}
              isLatestSystemMessage={msg.sender === 'system' && chatHistory[chatHistory.length - 1]?.id === msg.id}
              renderText={renderFormattedText}
            />
          </React.Fragment>
        ))}

        <VendorLookupResults
          summaries={vendorLookupSummary}
          getBadgeLabel={getVendorBadgeLabel}
        />

        {showContactSetup && (
          <ContactSetupCard
            attempted={contactValidationAttempted}
            errors={contactErrors}
            contactName={registrationState.contactName || ''}
            contactEmail={registrationState.contactEmail || ''}
            phonePrefix={uaePhonePrefix}
            phoneLocalNumber={uaePhoneLocalNumber}
            prefixOptions={UAE_MOBILE_PREFIX_OPTIONS}
            onContactNameChange={(value) => setRegistrationState(prev => ({ ...prev, contactName: value }))}
            onContactEmailChange={(value) => setRegistrationState(prev => ({ ...prev, contactEmail: value }))}
            onPrefixChange={(value) => {
              const nextPrefix = value as typeof uaePhonePrefix;
              setUaePhonePrefix(nextPrefix);
              setRegistrationState(prev => ({
                ...prev,
                phoneNumber: composeUaeMobileNumber(nextPrefix, uaePhoneLocalNumber),
              }));
            }}
            onPhoneLocalNumberChange={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, 7);
              setUaePhoneLocalNumber(digits);
              setRegistrationState(prev => ({
                ...prev,
                phoneNumber: composeUaeMobileNumber(uaePhonePrefix, digits),
              }));
            }}
            onSave={handleSaveContactInfo}
          />
        )}

        {isRequestInProgress && <ProcessingIndicator />}

        <div ref={chatEndRef} />
      </div>

      {/* Drag and Drop wrapper surrounding action input area */}
      {effectiveUploadType && (
        <UploadDropZone
          isUploading={isUploading}
          dragActive={dragActive}
          uploadTypeLabel={effectiveUploadType.replace(/_/g, ' ')}
          fileInputRef={fileInputRef}
          onFileClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onChange={handleFileChange}
        />
      )}

      {/* Input Form area */}
      {!showContactSetup && (
      <div className="border-t border-[color:rgba(44,53,97,0.12)] bg-white/95 px-4 py-1.5 backdrop-blur">
          <div className="rounded-[22px] border border-[color:rgba(44,53,97,0.12)] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] px-3 py-[2px]">
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  if (effectiveUploadType) {
                    fileInputRef.current?.click();
                  }
                }}
                disabled={!effectiveUploadType}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(44,53,97,0.12)] bg-[color:rgba(83,86,90,0.06)] text-[var(--brand-gray-light)] transition hover:border-[color:rgba(44,53,97,0.18)] hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                isUploading
                  ? 'Validation in progress... please wait...'
                  : isRequestInProgress
                    ? 'Processing request...'
                    : 'Describe the supplier request to route it...'
              }
              className="min-h-[38px] min-w-0 flex-1 rounded-full border border-transparent bg-transparent px-3 text-[13px] text-[var(--brand-primary-deep)] placeholder:text-[var(--brand-gray-light)] focus:outline-none"
              disabled={isUploading || isRequestInProgress}
            />
              <div className="flex items-center gap-2 pr-1 text-[var(--brand-gray-light)]">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(44,53,97,0.12)] bg-[color:rgba(83,86,90,0.06)] transition hover:border-[color:rgba(44,53,97,0.18)] hover:text-[var(--brand-primary)]"
                  aria-label="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isUploading || isRequestInProgress}
                  className="flex min-h-[40px] items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-primary-mid)] to-[var(--brand-sky)] px-4 py-1.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(44,53,97,0.32)] transition hover:from-[var(--brand-primary-deep)] hover:via-[var(--brand-primary-hover)] hover:to-[var(--brand-sky)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </div>
            </div>
            <div className="mt-1.5 flex flex-col gap-1 px-1 text-[11px] leading-[1.35] text-[var(--brand-neutral)] sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-[var(--brand-neutral)]">Press ↵ to send · ⇧↵ for a new line</span>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--brand-neutral)]">
                <span className="h-2 w-2 rounded-full bg-[var(--brand-sky)]" />
                Secured by Trojan Cloud
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
