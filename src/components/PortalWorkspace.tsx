import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2 } from 'lucide-react';
import AIAgentChat from './AIAgentChat';
import VerificationPanel from './VerificationPanel';
import type { ChatMessage, SupplierRegistrationState } from '../types';

type PortalWorkspaceProps = {
  submissionComplete: boolean;
  registrationState: SupplierRegistrationState;
  setRegistrationState: Dispatch<SetStateAction<SupplierRegistrationState>>;
  onConversationIdChange?: (conversationId: string | null) => void;
  chatHistory: ChatMessage[];
  setChatHistory: Dispatch<SetStateAction<ChatMessage[]>>;
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
  onSubmitRegistration: () => void | Promise<void>;
  onReset: () => void;
  isSubmittingRegistration: boolean;
  orchestratorResponse: Record<string, any> | null;
  orchestratorFinalStatus: Record<string, any>;
  orchestratorVendorId: string;
};

function RenderSubmissionSuccess({
  registrationState,
  orchestratorResponse,
  orchestratorFinalStatus,
  orchestratorVendorId,
  onReset,
}: Pick<
  PortalWorkspaceProps,
  'registrationState' | 'orchestratorResponse' | 'orchestratorFinalStatus' | 'orchestratorVendorId' | 'onReset'
>) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center py-2 animate-fade-in">
      <div className="flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-center border-b border-slate-100 px-4 py-2 sm:py-2.5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(44,53,97,0.16)] bg-[color:rgba(44,53,97,0.06)] text-[var(--brand-primary)] shadow-sm">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold uppercase tracking-tight text-slate-900 sm:text-base">Supplier Registration Successful!</h2>
              <p className="mx-auto max-w-md text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                Your enterprise registered for active procurement.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4.5">
          <div className="space-y-4">
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-left font-mono text-xs text-slate-600 space-y-1.5">
              <p>
                <strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block">Business Name:</strong>
                {registrationState.companyName || 'Dynamic Tech Enterprises Corp'}
              </p>
              {orchestratorResponse && (
                <div className="mt-3 rounded-lg border border-[color:rgba(44,53,97,0.14)] bg-[color:rgba(44,53,97,0.06)] p-3 text-left space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">Submission Status</p>
                  <div className="grid grid-cols-1 gap-2.5 text-slate-700 sm:grid-cols-2">
                    <div className="rounded-md border border-[color:rgba(44,53,97,0.12)] bg-white/80 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Submitted</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{String(orchestratorFinalStatus.submitted ? 'Yes' : 'No')}</p>
                    </div>
                    <div className="rounded-md border border-[color:rgba(44,53,97,0.12)] bg-white/80 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Approved</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{String(orchestratorFinalStatus.approved ? 'Yes' : 'No')}</p>
                    </div>
                    {orchestratorVendorId ? (
                      <div className="rounded-md border border-[color:rgba(44,53,97,0.12)] bg-white/80 px-3 py-2 sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Registration Vendor ID</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{orchestratorVendorId}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {registrationState.yearsInBusiness && (
                <div className="border-t border-slate-200 pt-2.5 mt-2.5 font-sans text-slate-700 text-[11px] grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Vendor Type</span><strong className="text-slate-800 text-xs">{registrationState.vendorType || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Selected Product</span><strong className="text-slate-800 text-xs">{registrationState.surveyProduct || 'N/A'}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Years in Business</span><strong className="text-slate-800 text-xs">{registrationState.yearsInBusiness}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Total Staff</span><strong className="text-slate-800 text-xs">{registrationState.totalStaff}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Total Labors</span><strong className="text-slate-800 text-xs">{registrationState.totalLabors}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Engineers among Staff</span><strong className="text-slate-800 text-xs">{registrationState.totalEngineers}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Testing Facility Available</span><strong className="text-slate-800 text-xs">{registrationState.testingFacility}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Product Listing Coverage</span><strong className="text-slate-800 text-xs">{registrationState.clientConsultantListings} client(s)/consultant(s)</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Projects executed (last 3y)</span><strong className="text-slate-800 text-xs">{registrationState.projectsLast3Years}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Biggest Project (last 3y)</span><strong className="text-slate-800 text-xs">{registrationState.biggestProjectValue}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Annual Turnover</span><strong className="text-slate-800 text-xs">{registrationState.annualTurnover}</strong></div>
                  <div><span className="text-slate-400 uppercase text-[9px] font-bold block">Factory Asset Value</span><strong className="text-slate-800 text-xs">{registrationState.factoryAssetValue}</strong></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3.5 sm:px-6 flex justify-center">
          <button
            onClick={onReset}
            className="w-full bg-slate-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black sm:w-auto"
          >
            Onboard another supplier
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalWorkspace({
  submissionComplete,
  registrationState,
  setRegistrationState,
  onConversationIdChange,
  chatHistory,
  setChatHistory,
  onAnalyzeDocument,
  onSubmitRegistration,
  onReset,
  isSubmittingRegistration,
  orchestratorResponse,
  orchestratorFinalStatus,
  orchestratorVendorId,
}: PortalWorkspaceProps) {
  if (submissionComplete) {
    return (
      <RenderSubmissionSuccess
        registrationState={registrationState}
        orchestratorResponse={orchestratorResponse}
        orchestratorFinalStatus={orchestratorFinalStatus}
        orchestratorVendorId={orchestratorVendorId}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 items-stretch gap-3.5 lg:grid-cols-12">
      <div className="flex h-full min-h-0 lg:col-span-7 xl:col-span-8">
        <AIAgentChat
          registrationState={registrationState}
          setRegistrationState={setRegistrationState}
          onConversationIdChange={onConversationIdChange}
          onAnalyzeDocument={onAnalyzeDocument}
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
        />
      </div>

      <div className="flex h-full min-h-0 lg:col-span-5 xl:col-span-4 lg:self-start lg:h-[calc(100%-10px)] text-slate-800">
        <VerificationPanel
          registrationState={registrationState}
          setRegistrationState={setRegistrationState}
          onSubmitRegistration={onSubmitRegistration}
          isSubmitting={isSubmittingRegistration}
        />
      </div>
    </div>
  );
}
