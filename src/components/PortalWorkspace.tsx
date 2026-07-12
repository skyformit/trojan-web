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
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 p-8 rounded-lg shadow-sm text-center space-y-6 animate-fade-in mt-6">
      <div className="w-16 h-16 bg-[color:rgba(44,53,97,0.06)] border border-[color:rgba(44,53,97,0.16)] text-[var(--brand-primary)] rounded-full flex items-center justify-center mx-auto shadow-sm">
        <CheckCircle2 className="w-9 h-9" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Supplier Registration Successful!</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
           Your enterprise registered for active procurement.
        </p>
      </div>

      <div className="bg-slate-50 p-5 rounded border border-slate-200 text-left font-mono text-xs text-slate-600 space-y-2">
        <p><strong className="text-slate-900 font-sans uppercase text-[10px] tracking-wider block">Business Name:</strong> {registrationState.companyName || "Dynamic Tech Enterprises Corp"}</p>
        {orchestratorResponse && (
        <div className="mt-4 rounded-lg border border-[color:rgba(44,53,97,0.14)] bg-[color:rgba(44,53,97,0.06)] p-4 text-left space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">Submission Status</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
              <div className="rounded-md bg-white/80 border border-[color:rgba(44,53,97,0.12)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Submitted</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {String(orchestratorFinalStatus.submitted ? 'Yes' : 'No')}
                </p>
              </div>
              <div className="rounded-md bg-white/80 border border-[color:rgba(44,53,97,0.12)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Approved</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {String(orchestratorFinalStatus.approved ? 'Yes' : 'No')}
                </p>
              </div>
              {orchestratorVendorId ? (
                <div className="rounded-md bg-white/80 border border-[color:rgba(44,53,97,0.12)] px-3 py-2 sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Registration Vendor ID</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{orchestratorVendorId}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
        {registrationState.yearsInBusiness && (
          <div className="border-t border-slate-200 pt-3 mt-3 font-sans text-slate-700 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
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

      <button
        onClick={onReset}
        className="mt-4 bg-slate-900 hover:bg-black text-white font-bold text-[10px] uppercase tracking-widest py-3 px-6 rounded-sm transition"
      >
        Onboard another supplier
      </button>
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

      <div className="flex h-full min-h-0 lg:col-span-5 xl:col-span-4 text-slate-800">
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
