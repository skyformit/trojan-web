import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, CheckCircle2, ShieldAlert, RefreshCw, Bot, HelpCircle, Sparkles, ArrowRight, Mail, Phone, UserCheck } from 'lucide-react';
import { ChatMessage, SupplierRegistrationState, DocumentVerification } from '../types';
import { streamChatMessage } from '../utils/chatStream';

interface AIAgentChatProps {
  registrationState: SupplierRegistrationState;
  setRegistrationState: React.Dispatch<React.SetStateAction<SupplierRegistrationState>>;
  onAnalyzeDocument: (type: 'trade_license' | 'vat_certificate' | 'bank_document', fileBase64: string | null, mimeType: string, isPresetSample?: { companyName: string }) => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export default function AIAgentChat({
  registrationState,
  setRegistrationState,
  onAnalyzeDocument,
  chatHistory,
  setChatHistory
}: AIAgentChatProps) {
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeUploadType, setActiveUploadType] = useState<'trade_license' | 'vat_certificate' | 'bank_document' | null>('trade_license');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSeconds, setSimulationSeconds] = useState(10);
  const [activeUploadFile, setActiveUploadFile] = useState<{ base64: string | null; mimeType: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: any;
    if (isSimulating && simulationSeconds > 0) {
      timer = setTimeout(() => {
        const nextSec = simulationSeconds - 1;
        setSimulationSeconds(nextSec);
        
        // At key increments, append helpful progress logs to simulation conversation
        if (nextSec === 8) {
          setChatHistory(prev => [...prev, {
            id: 'sim-log-8-' + Date.now(),
            sender: 'system',
            text: `Uploading document files...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } else if (nextSec === 6) {
          setChatHistory(prev => [...prev, {
            id: 'sim-log-6-' + Date.now(),
            sender: 'system',
            text: `Initiating model OCR visual extraction pattern scanner...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } else if (nextSec === 4) {
          setChatHistory(prev => [...prev, {
            id: 'sim-log-4-' + Date.now(),
            sender: 'system',
            text: `Parsed OCR values. Requesting real-time database verification for duplicate check...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        } else if (nextSec === 2) {
          setChatHistory(prev => [...prev, {
            id: 'sim-log-2-' + Date.now(),
            sender: 'system',
            text: `Checking for the expiry date of document...`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }
      }, 1000);
    } else if (isSimulating && simulationSeconds === 0) {
      finishSimulation();
    }
    return () => clearTimeout(timer);
  }, [isSimulating, simulationSeconds]);

  const startSimulation = (fileBase64: string | null = null, mimeType: string = 'image/png') => {
    if (!activeUploadType || isSimulating) return;
    setIsSimulating(true);
    setSimulationSeconds(10);
    setActiveUploadFile({ base64: fileBase64, mimeType });
    
    setChatHistory(prev => [...prev, {
      id: 'sim-log-start-' + Date.now(),
      sender: 'system',
      text: `Initiated automated verification...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const finishSimulation = async () => {
    setIsSimulating(false);
    if (!activeUploadType) return;

    // Use current company if matched, otherwise default to AeroTech Solutions Ltd for premium look
    const currentName = registrationState.companyName || "AeroTech Solutions Ltd";
    const validNames = [
      "AeroTech Solutions Ltd", 
      "Global Logistics & Supply Chain Corp", 
      "Pacific Agro Foods Co", 
      "Apex Industrial Supplies LLC"
    ];
    let companyToUse = currentName;
    if (!validNames.includes(currentName)) {
      companyToUse = "AeroTech Solutions Ltd";
      // Force match in state
      setRegistrationState(prev => ({
        ...prev,
        companyName: companyToUse
      }));
    }

    setChatHistory(prev => [...prev, {
      id: 'sim-log-end-' + Date.now(),
      sender: 'system',
      text: `Verification checklist approved. Appending corporate credentials...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    await onAnalyzeDocument(
      activeUploadType,
      activeUploadFile?.base64 || null,
      activeUploadFile?.mimeType || 'image/png',
      { companyName: companyToUse }
    );

    setActiveUploadFile(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Adjust active expectations based on registration sequence step
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

  // Automated welcome script on initial mount
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([
        {
          id: 'welcome',
          sender: 'agent',
          text: `Hello and welcome to the Secure Supplier Portal! 🛡️\n\nI am your AI Onboarding Assistant. I am here to guide you step-by-step through our supplier registration program. To align with corporate and compliance standards, we require authentication of three vital company certificates in real-time:\n\n1. **Valid Trade License**\n2. **VAT Registration Certificate**\n3. **Official Bank Document (Account ownership statement)**\n\nLet's begin! **What is the registered Commercial Name of your Enterprise?** `,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) {
      setInputText('');
    }

    // Add user message to history
    const userMsgId = 'user-' + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, newUserMessage]);

    // Handle bot logic processing based on state
    setTimeout(() => {
      processAgentResponse(text);
    }, 800);
  };

  const handleSaveContactInfo = (name?: string, email?: string, phone?: string) => {
    const cName = name || registrationState.contactName || 'N/A';
    const cEmail = email || registrationState.contactEmail || 'N/A';
    const cPhone = phone || registrationState.phoneNumber || 'N/A';

    setChatHistory(prev => [
      ...prev,
      {
        id: 'contact-submit-' + Date.now(),
        sender: 'user',
        text: `Full Name: ${cName}\nEmail: ${cEmail}\nMobile: ${cPhone}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    setTimeout(async () => {
      setRegistrationState(prev => ({
        ...prev,
        contactName: cName,
        contactEmail: cEmail,
        phoneNumber: cPhone,
        currentStep: 'trade_license_upload'
      }));

      await streamChatMessage(
        setChatHistory,
        `✦ **Contact Details Registered** ✦\n\n- **Recipient Name**: "${cName}"\n- **Notification Channels**: Email (${cEmail}) & SMS (${cPhone})\n\nAwesome, we've enabled compliance system updates for you. Now, let's verify your company's credentials.\n\nPlease upload or drop your **Valid Trade License** (PDF) to proceed.`
      );
    }, 850);
  };

  const processAgentResponse = async (userText: string) => {
    const currentStep = registrationState.currentStep;

    let botResponse = '';
    let nextStepState: any = {};

    if (currentStep === 'initial') {
      // Parse Company name from input
      const companyName = userText;
      botResponse = `Excellent! I have recorded your company as "**${companyName}**".\n\nTo ensure you receive direct email and SMS notifications regarding verification events and onboarding progress, please provide your contact details:\n\n• **Full Name**\n• **Email Address**\n• **Mobile Number**\n\nYou can fill them in the interactive form below!`;
      
      nextStepState = {
        companyName: companyName,
        currentStep: 'contact_info'
      };
    } else if (currentStep === 'contact_info') {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
      const emailMatch = userText.match(emailRegex);
      const email = emailMatch ? emailMatch[1] : '';

      const phoneRegex = /(\+?[\d\s-]{7,15})/;
      const phoneMatch = userText.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '').match(phoneRegex);
      const phone = phoneMatch ? phoneMatch[1].trim() : '';

      let name = userText
        .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '')
        .replace(/(\+?[\d\s-]{7,15})/g, '')
        .replace(/[,;|]/g, '')
        .trim();
      
      if (!name || name.length > 30) {
        name = 'Authorized Contact';
      }

      const mergedName = registrationState.contactName || name;
      const mergedEmail = registrationState.contactEmail || email;
      const mergedPhone = registrationState.phoneNumber || phone;

      // Update state
      setRegistrationState(prev => ({
        ...prev,
        contactName: mergedName,
        contactEmail: mergedEmail,
        phoneNumber: mergedPhone
      }));

      if (mergedEmail && mergedPhone) {
        botResponse = `✦ **Contact Details Registered** ✦\n\n- **Recipient Name**: "${mergedName}"\n- **Notification Channels**: Email (${mergedEmail}) & SMS (${mergedPhone})\n\nAwesome, we've enabled compliance system updates for you. Now, let's verify your company's credentials.\n\nPlease upload or drop your **Valid Trade License** (e.g. PDF) to proceed.`;
        nextStepState = {
          currentStep: 'trade_license_upload'
        };
      } else {
        botResponse = `Thanks for submitting contact details. I have pre-filled some of your information. Please confirm/fill the remaining fields in the **Notification Setup Form** card below to proceed!`;
      }
    } else if (currentStep === 'trade_license_upload' && !registrationState.documents.trade_license.extractedData) {
      botResponse = `I'm still waiting for your **Trade License** document before we can proceed. Please drag-and-drop the file or click the upload icon to supply the document so we can trigger validation.`;
    } else if (currentStep === 'vat_upload' && !registrationState.documents.vat_certificate.extractedData) {
      botResponse = `Please upload or inject your **VAT Certificate** to proceed with real-time tax validation. Let me know if you are facing any issues!`;
    } else if (currentStep === 'bank_document_upload' && !registrationState.documents.bank_document.extractedData) {
      botResponse = `Please provide your official **Bank Document** (e.g., bank statement or letter) so our system can finalize alignment logs with banking clearing network databases.`;
    } else if (currentStep === 'review') {
      botResponse = `All your corporate documents are validated and logged! Please review the registry verification compliance report on the right scoreboard, and press the **"Complete & File Registration"** button to establish your authorized supplier profile.`;
    } else {
      botResponse = `Thank you! Your registration index has been published to our procurement portal ledger. You stand as a green-lit accredited supplier.`;
    }

    setRegistrationState(prev => ({
      ...prev,
      ...nextStepState
    }));

    await streamChatMessage(setChatHistory, botResponse);
  };

  // Upload actions orchestration
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeUploadType) return;
    await processFileUpload(files[0], activeUploadType);
  };

  const processFileUpload = async (file: File, type: 'trade_license' | 'vat_certificate' | 'bank_document') => {
    setIsUploading(true);
    
    // Add temporary uploading log in chat
    const logId = 'log-' + Date.now();
    setChatHistory(prev => [...prev, {
      id: logId,
      sender: 'system',
      text: `Uploading file "${file.name}" for ${type.replace(/_/g, ' ')} alignment...`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        setIsUploading(false);
        // Automatically trigger simulation upon file load
        startSimulation(base64, file.type);
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      setChatHistory(prev => [...prev, {
        id: 'error-' + Date.now(),
        sender: 'agent',
        text: `Error uploading document: ${err.message || 'File processing failed'}. Please retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  // Drag and drop events
  const [dragActive, setDragActive] = useState(false);

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={`${index}-${part}`} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      return <React.Fragment key={`${index}-${part}`}>{part}</React.Fragment>;
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!activeUploadType) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFileUpload(e.dataTransfer.files[0], activeUploadType);
    }
  };

  const getStepIndicator = () => {
    const step = registrationState.currentStep;
    if (step === 'initial') return 'Step 1: Account Identification';
    if (step === 'contact_info') return 'Step 2: Notification Setup';
    if (step === 'trade_license_upload') return 'Step 3: Trade License Audit';
    if (step === 'vat_upload') return 'Step 4: VAT Compliance Audit';
    if (step === 'bank_document_upload') return 'Step 5: Bank Account Clearance';
    if (step === 'review') return 'Step 6: Compliance Scores';
    return 'Registration Approved';
  };

  const isAgentStreaming = chatHistory.some(message => message.sender === 'agent' && message.isPending);

  return (
    <div className="flex flex-col h-[600px] border border-slate-200 bg-white rounded-lg overflow-hidden shadow-sm">
      {/* Bot Chat Header with security seal */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Onboarding Officer (AI Agent)</h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Real-time OCR Validation Service Online</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-sm">
            {getStepIndicator()}
          </span>
        </div>
      </div>

      {/* Messages Scroll Frame */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
        {chatHistory.map((msg) => {
          if (msg.sender === 'system') {
            const isLatest = chatHistory[chatHistory.length - 1]?.id === msg.id;
            const shouldSpin = isSimulating && isLatest;
            return (
              <div key={msg.id} className="flex justify-center">
                <div className={`text-[10px] py-1 px-3 rounded border flex items-center gap-2 ${
                  shouldSpin 
                    ? 'bg-indigo-50 text-indigo-700 font-mono border-indigo-100 shadow-xs' 
                    : 'bg-slate-100 text-slate-500 font-mono border-slate-200'
                }`}>
                  {shouldSpin ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 text-[10px] font-bold">
                  AI
                </div>
              )}
              
              <div className={`max-w-[85%] rounded-lg px-4 py-3 text-xs leading-relaxed ${
                isUser 
                  ? 'bg-indigo-600 text-white rounded-br-none font-medium shadow-sm' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm'
              }`}>
                {/* Process text highlights for headings/bold styling */}
                <div className="whitespace-pre-line font-sans">
                  {msg.isPending && !msg.text ? (
                    <span className="text-slate-400 italic">Typing…</span>
                  ) : (
                    <>
                      {renderFormattedText(msg.text)}
                      {msg.isPending && <span className="ml-1 inline-block animate-pulse text-slate-400">▍</span>}
                    </>
                  )}
                </div>
                
                {msg.fileDetails && (
                  <div className="mt-2.5 flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded text-[11px] font-mono">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <div className="flex-1 overflow-hidden text-slate-700">
                      <p className="font-semibold truncate">{msg.fileDetails.name}</p>
                      <p className="text-[9px] text-slate-400">{msg.fileDetails.size}</p>
                    </div>
                  </div>
                )}
                
                <p className="text-[9px] text-right text-slate-400 mt-1 font-mono">{msg.timestamp}</p>
              </div>
            </div>
          );
        })}
        
        {registrationState.currentStep === 'contact_info' && !isAgentStreaming && (
          <div className="bg-white border hover:border-indigo-200 border-indigo-100 rounded-lg p-5 shadow-sm space-y-3.5 max-w-[90%] mx-auto font-sans text-slate-800 animate-fade-in">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider border-b border-indigo-50 pb-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>Notification Contact Setup</span>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={registrationState.contactName || ''}
                  onChange={(e) => setRegistrationState(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Primary Notification Email</span>
                </label>
                <input
                  type="email"
                  placeholder="john.doe@company.com"
                  value={registrationState.contactEmail || ''}
                  onChange={(e) => setRegistrationState(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Mobile Phone Number</span>
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 0122"
                  value={registrationState.phoneNumber || ''}
                  onChange={(e) => setRegistrationState(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded px-3 py-2 focus:outline-none transition font-medium"
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveContactInfo()}
              disabled={!registrationState.contactName?.trim() || !registrationState.contactEmail?.trim() || !registrationState.phoneNumber?.trim()}
              className="w-full text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-sm transition flex items-center justify-center gap-2 mt-2 shadow-xs"
            >
              <span>Save Contact Config & Proceed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Drag and Drop wrapper surrounding action input area */}
      {activeUploadType && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`px-4 py-3.5 text-center border-t border-dashed transition-all ${
            isSimulating 
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700 animate-pulse'
              : dragActive 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
            disabled={isSimulating}
          />
          {isSimulating ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-1">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Verification In Progress...</span>
              </div>
              <div className="w-full max-w-xs bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(10 - simulationSeconds) * 10}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-[11px]">
                <Upload className={`w-3.5 h-3.5 ${dragActive ? 'animate-bounce text-indigo-600' : 'text-slate-400'}`} />
                <span>
                  Drag & Drop verification files here or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-indigo-600 hover:text-indigo-700 font-bold underline underline-offset-2"
                  >
                    select from computer
                  </button>{' '}
                  for <strong className="text-slate-800 uppercase font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px] ml-0.5">{activeUploadType.replace(/_/g, ' ')}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Input Form area */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={
            isSimulating
              ? "Simulation in progress... please wait..."
              : registrationState.currentStep === 'initial' 
                ? "Type Company Name to begin..." 
                : "Ask a verification question, or type response..."
          }
          className="flex-1 text-xs bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded py-2 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
          disabled={isUploading || isSimulating}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isUploading || isSimulating}
          className="p-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:hover:bg-indigo-600 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
