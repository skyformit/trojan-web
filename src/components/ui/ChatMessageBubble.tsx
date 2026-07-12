import { FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChatMessage } from '../../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isLatestSystemMessage?: boolean;
  isUploading?: boolean;
  renderText: (text: string, tone?: 'agent' | 'user') => ReactNode;
}

export default function ChatMessageBubble({
  message,
  isLatestSystemMessage = false,
  isUploading = false,
  renderText,
}: ChatMessageBubbleProps) {
  if (message.sender === 'system') {
    const shouldSpin = isUploading && isLatestSystemMessage;
    return (
      <div className="flex justify-center">
        <div
          className={`max-w-[92%] rounded-full border px-3 py-[5px] flex items-center gap-2 text-[11px] shadow-sm ${
            shouldSpin
              ? 'bg-[color:rgba(44,53,97,0.08)] text-[var(--brand-primary)] font-mono border-[color:rgba(44,53,97,0.15)]'
              : 'bg-[color:rgba(44,53,97,0.05)] text-[var(--brand-neutral)] font-mono border-[color:rgba(44,53,97,0.12)]'
          }`}
        >
          {shouldSpin ? (
            <RefreshCw className="w-3 h-3 animate-spin text-[var(--brand-sky)]" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      </div>
    );
  }

  const isUser = message.sender === 'user';
  const isAgent = message.sender === 'agent';

  return (
    <div className={`relative flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2.5 ${isAgent ? 'pl-1' : ''}`}>
      {!isUser && (
        <div className="relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary-mid)] to-[var(--brand-sky)] text-white border-2 border-white shadow-[0_10px_24px_rgba(44,53,97,0.28)] text-[10px] font-extrabold md:h-10 md:w-10">
          AI
        </div>
      )}

      <div
        className={`relative z-10 ${isAgent ? 'w-full max-w-[80%] rounded-[22px] px-5 py-3.5' : 'max-w-[92%] rounded-[24px] px-5 py-3.5'} text-[13px] leading-[1.5] ${
          isUser
            ? 'bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary-mid)] to-[var(--brand-sky)] text-white rounded-br-md font-medium shadow-[0_12px_30px_rgba(44,53,97,0.24)]'
            : 'bg-white/97 text-[var(--brand-primary-deep)] border border-[color:rgba(44,53,97,0.14)] rounded-bl-[18px] shadow-[0_18px_40px_rgba(44,53,97,0.08)] ring-1 ring-[color:rgba(44,53,97,0.06)]'
        }`}
      >
        <div className={`${isUser ? 'whitespace-pre-line font-sans' : 'font-sans'} ${isAgent ? 'text-[13px] leading-[1.5]' : ''}`}>
          {message.isPending && !message.text ? (
            <span className="text-[var(--brand-gray-light)] italic">Typing…</span>
          ) : (
            <>
              {renderText(message.text, isUser ? 'user' : 'agent')}
              {message.isPending && <span className="ml-1 inline-block animate-pulse text-[var(--brand-gray-light)]">▍</span>}
            </>
          )}
        </div>

        {message.fileDetails && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color:rgba(44,53,97,0.12)] bg-[color:rgba(44,53,97,0.04)] p-3 text-[11px] font-mono">
            <FileText className="w-4 h-4 text-[var(--brand-sky)]" />
            <div className="flex-1 overflow-hidden text-[var(--brand-neutral)]">
              <p className="font-semibold truncate">{message.fileDetails.name}</p>
              <p className="text-[9px] text-[var(--brand-gray-light)]">{message.fileDetails.size}</p>
            </div>
          </div>
        )}

        {isAgent ? (
          <div className="mt-2 flex items-end justify-between gap-3 text-[10px] font-mono tracking-[0.16em] text-[var(--brand-neutral)]">
            <span className="normal-case font-semibold text-[var(--brand-neutral)]">Encrypted • end-to-end</span>
            <span className="tracking-[0.14em] text-[var(--brand-primary-deep)]">{message.timestamp}</span>
          </div>
        ) : (
          <p className={`mt-1 text-[10px] text-right font-mono ${isUser ? 'text-[color:rgba(255,255,255,0.84)]' : 'text-[var(--brand-neutral)]'}`}>{message.timestamp}</p>
        )}
      </div>
    </div>
  );
}
