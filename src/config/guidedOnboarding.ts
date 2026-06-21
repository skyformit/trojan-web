import type { SupplierRegistrationState } from '../types';

export type GuidedOnboardingField =
  | 'companyName'
  | 'contactName'
  | 'contactEmail'
  | 'phoneNumber';

export type GuidedOnboardingAnswerState = Record<GuidedOnboardingField, string>;

export type GuidedOnboardingQuestion = {
  field: GuidedOnboardingField;
  prompt: string;
};

export const GUIDED_ONBOARDING_CONFIG = {
  enabledFlag: 'VITE_ENABLE_GUIDED_ONBOARDING_FLOW',
  triggers: [
    /\bonboard(?:ing)?\b/i,
    /\bnew\s+supplier\b/i,
    /\bsupplier\s+onboarding\b/i,
    /\bsupplier\s+registration\b/i,
    /\bregister\s+as\s+(a\s+)?supplier\b/i,
    /\bbecome\s+a\s+supplier\b/i,
    /\bstart\s+(the\s+)?onboarding\b/i,
  ],
  questions: [
    {
      field: 'companyName',
      prompt: 'Great. What is your registered company name as per the trade license?',
    },
    {
      field: 'contactName',
      prompt: 'Who is the contact person for this application?',
    },
    {
      field: 'contactEmail',
      prompt: 'Please provide the contact email address.',
    },
    {
      field: 'phoneNumber',
      prompt: 'Please provide the mobile number.',
    },
  ] as GuidedOnboardingQuestion[],
  labels: {
    companyName: 'company name',
    contactName: 'contact person name',
    contactEmail: 'contact email',
    phoneNumber: 'mobile number',
  } satisfies Record<GuidedOnboardingField, string>,
  intro: 'Understood. I will guide you through the supplier onboarding flow step by step.',
  introLeadIn: 'Let us start with the commercial name.',
  completion: 'Next, please upload your valid trade license PDF so we can continue with verification.',
  companyNameClassifierPrompt: [
    'You are classifying a user reply during supplier onboarding.',
    'Decide whether the reply is a valid company name, a greeting, or unrelated text.',
    'Return ONLY JSON with the keys:',
    '{ "kind": "company_name" | "greeting" | "unrelated", "value": "extracted company name or empty string", "reason": "short reason" }',
    'Rules:',
    '- If the user only says hi/hello/hey/thanks, return kind greeting.',
    '- If the user asks a question, returns a generic sentence, or does not provide a company/business name, return kind unrelated.',
    '- If the message contains a business or supplier name, extract the company name.',
    '- Do not guess. Only classify as company_name when a real company name is present.',
  ].join('\n'),
  workflowName: 'GUIDED_SUPPLIER_ONBOARDING',
  workflowApiPath: '/api/invoke-general-bot',
  initialStep: 'initial' as const,
  completedStep: 'trade_license_upload' as const,
} as const;

const COMPANY_NAME_SUFFIX_PATTERN =
  /\b(llc|l\.l\.c|ltd|limited|company|co|corp|corporation|enterprise|group|fze|fzc|est|trading)\b/i;

const COMPANY_NAME_KEYWORDS = [
  'construction',
  'machinery',
  'trading',
  'materials',
  'services',
  'service',
  'engineering',
  'center',
  'centre',
  'group',
  'company',
  'contracting',
  'contracts',
  'logistics',
  'solutions',
  'technology',
  'technologies',
  'industries',
  'industrial',
  'international',
  'supplies',
  'supply',
  'general',
  'transport',
  'real estate',
  'consulting',
  'projects',
  'equipment',
];

export function isGuidedOnboardingTrigger(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return GUIDED_ONBOARDING_CONFIG.triggers.some(pattern => pattern.test(normalized));
}

export function getGuidedOnboardingQuestion(index: number) {
  return GUIDED_ONBOARDING_CONFIG.questions[index] || null;
}

export function formatGuidedOnboardingPrompt(prompt: string) {
  const trimmed = prompt.trim();
  return trimmed ? `**${trimmed}**` : '';
}

export function getGuidedOnboardingIntroPrompt() {
  const firstQuestion = getGuidedOnboardingQuestion(0);
  return [
    GUIDED_ONBOARDING_CONFIG.intro,
    '',
    GUIDED_ONBOARDING_CONFIG.introLeadIn,
    firstQuestion ? formatGuidedOnboardingPrompt(firstQuestion.prompt) : formatGuidedOnboardingPrompt('What is your company name?'),
  ].join('\n');
}

export function getGuidedOnboardingStartPrompt(startIndex: number, companyName?: string) {
  const nextQuestion = getGuidedOnboardingQuestion(startIndex);

  if (startIndex <= 0) {
    return getGuidedOnboardingIntroPrompt();
  }

  const leadIn = companyName
    ? `Great. I have recorded "${companyName.trim()}".`
    : 'Great. I have recorded your company name.';

  return [
    GUIDED_ONBOARDING_CONFIG.intro,
    '',
    leadIn,
    '',
    nextQuestion ? formatGuidedOnboardingPrompt(nextQuestion.prompt) : formatGuidedOnboardingPrompt('Who is the contact person for this application?'),
  ].join('\n');
}

export function getGuidedOnboardingFieldLabel(field: GuidedOnboardingField) {
  return GUIDED_ONBOARDING_CONFIG.labels[field] || 'details';
}

export function normalizeGuidedOnboardingAnswer(field: GuidedOnboardingField, value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (field === 'companyName') {
    const labeledMatch = trimmed.match(/^(?:company\s+name|company|commercial\s+name|vendor\s+name|vendor)\s*[:\-]?\s*(.+)$/i);
    if (labeledMatch?.[1]) {
      return labeledMatch[1].trim();
    }

    const explicitMatch = trimmed.match(/(?:my|our)\s+company\s+name\s+is\s+(.+)$/i);
    if (explicitMatch?.[1]) {
      return explicitMatch[1].trim();
    }
  }

  return trimmed;
}

export function validateGuidedCompanyName(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const tokens = trimmed
    .split(/\s+/)
    .map(token => token.replace(/[^a-z]/gi, ''))
    .filter(Boolean);

  if (!trimmed) {
    return { valid: false, reason: 'Company name is required.' };
  }

  if (/^(hi|hello|hey|thanks|thank you)\b/i.test(lower)) {
    return { valid: false, reason: 'Greeting detected.' };
  }

  if (/\?$/.test(trimmed) || /^(what|how|why|when|where|who|which|can you|could you|would you|should i|is it|are you|am i|do you|does it|please)\b/i.test(lower)) {
    return { valid: false, reason: 'Question-like reply detected.' };
  }

  if (trimmed.length < 3) {
    return { valid: false, reason: 'Company name is too short.' };
  }

  if (!/[A-Za-z]/.test(trimmed)) {
    return { valid: false, reason: 'Company name must include letters.' };
  }

  const hasCompanySuffix = COMPANY_NAME_SUFFIX_PATTERN.test(trimmed);
  const hasKeywordMatch = COMPANY_NAME_KEYWORDS.some(keyword => lower.includes(keyword));
  const hasMinimumStructure = tokens.length >= 2;
  const hasBusinessSignal = hasCompanySuffix || hasKeywordMatch;

  if (!hasMinimumStructure) {
    return { valid: false, reason: 'Company name is too short.' };
  }

  if (!hasBusinessSignal) {
    return {
      valid: false,
      reason: 'Please enter a business name with a company indicator such as LLC, Trading, Company, Group, Construction, Services, or Engineering.',
    };
  }

  return { valid: true, reason: '' };
}

export function normalizeUaeMobileNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  let normalized = digits;

  if (normalized.startsWith('00971')) {
    normalized = normalized.slice(5);
  } else if (normalized.startsWith('971')) {
    normalized = normalized.slice(3);
  }

  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

export function normalizeGuidedPhoneNumber(value: string) {
  return normalizeUaeMobileNumber(value);
}

export function validateGuidedPhoneNumber(value: string) {
  const normalized = normalizeUaeMobileNumber(value);

  if (!/^5[1-9]\d{7}$/.test(normalized)) {
    return {
      valid: false,
      reason: 'Enter a valid UAE mobile number using +971 and a 51 to 59 prefix followed by 7 digits.',
    };
  }

  return { valid: true, reason: '', normalized };
}

export function validateGuidedEmail(value: string) {
  const trimmed = value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return {
    valid,
    reason: valid ? '' : 'Enter a valid email address.',
  };
}

export function applyGuidedAnswerToRegistrationState(
  previous: SupplierRegistrationState,
  field: GuidedOnboardingField,
  value: string
): SupplierRegistrationState {
  switch (field) {
    case 'companyName':
      return { ...previous, companyName: value };
    case 'contactName':
      return { ...previous, contactName: value };
    case 'contactEmail':
      return { ...previous, contactEmail: value };
    case 'phoneNumber':
      return { ...previous, phoneNumber: value };
    default:
      return previous;
  }
}

export function getGuidedOnboardingCompletionPrompt(answers: GuidedOnboardingAnswerState) {
  const summaryLines = Object.entries(answers)
    .filter(([, value]) => value.trim())
    .map(([field, value]) => `- **${getGuidedOnboardingFieldLabel(field as GuidedOnboardingField)}**: ${value}`);

  return [
    'Thanks. I have captured the onboarding details.',
    '',
    summaryLines.length > 0 ? '**Captured details**' : '',
    ...summaryLines,
    '',
    GUIDED_ONBOARDING_CONFIG.completion,
  ]
    .filter(Boolean)
    .join('\n');
}
