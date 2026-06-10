import type { Dispatch, SetStateAction } from 'react';
import type { ChatMessage } from '../types';

type ChatHistorySetter = Dispatch<SetStateAction<ChatMessage[]>>;

type StreamOptions = {
  sender?: ChatMessage['sender'];
  chunkDelayMs?: number;
  timestamp?: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function streamChatMessage(
  setChatHistory: ChatHistorySetter,
  text: string,
  options: StreamOptions = {}
) {
  const sender = options.sender ?? 'agent';
  const chunkDelayMs = options.chunkDelayMs ?? 36;
  const timestamp = options.timestamp ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageId = `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const chunks = text.match(/\S+\s*/g) ?? [text];

  setChatHistory(prev => [
    ...prev,
    {
      id: messageId,
      sender,
      text: '',
      timestamp,
      isPending: true
    }
  ]);

  for (const chunk of chunks) {
    await sleep(chunkDelayMs);
    setChatHistory(prev =>
      prev.map(message =>
        message.id === messageId
          ? { ...message, text: `${message.text}${chunk}` }
          : message
      )
    );

    const trimmedChunk = chunk.trimEnd();
    if (/[.!?]$/.test(trimmedChunk)) {
      await sleep(120);
    } else if (trimmedChunk.endsWith(',') || trimmedChunk.endsWith(';') || trimmedChunk.endsWith(':')) {
      await sleep(55);
    }
  }

  setChatHistory(prev =>
    prev.map(message =>
      message.id === messageId
        ? { ...message, text, isPending: false }
        : message
    )
  );
}
