import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  MessageSquare,
  Mail,
  Phone,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const COMMON_COUNTRY_CODES = [
  { code: '+1', country: 'US / CA' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'IN' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+81', country: 'JP' },
  { code: '+86', country: 'CN' },
  { code: '+61', country: 'AU' },
  { code: '+55', country: 'BR' },
  { code: '+7', country: 'RU' },
  { code: '+971', country: 'UAE' },
  { code: '+65', country: 'SG' },
];

export const AuthPage: React.FC = () => {
  // Step: 'INPUT' | 'OTP' | 'PROFILE' | 'LEGACY'
  const [step, setStep] = useState<'INPUT' | 'OTP' | 'PROFILE' | 'LEGACY'>('INPUT');
  const [authMethod, setAuthMethod] = useState<'PHONE' | 'EMAIL'>('PHONE');

  // Phone input state
  const [countryCode, setCountryCode] = useState('+1');
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  
  // Email input state
  const [email, setEmail] = useState('');

  // OTP input state (6 digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Profile setup state (New User)
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Legacy login state
  const [legacyIdentifier, setLegacyIdentifier] = useState('');
  const [legacyPassword, setLegacyPassword] = useState('');

  // General error banner
  const [errorMsg, setErrorMsg] = useState('');

  const {
    sendOtp,
    verifyOtp,
    registerProfile,
    checkUsername,
    activeTicket,
    login,
    isAuthenticating,
  } = useAuthStore();

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Live username availability check debounce
  useEffect(() => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      setUsernameAvailable(null);
      setUsernameError(clean.length > 0 ? 'Minimum 3 alphanumeric characters' : null);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }

    setUsernameChecking(true);
    setUsernameError(null);
    const timeout = setTimeout(async () => {
      const res = await checkUsername(clean);
      setUsernameChecking(false);
      setUsernameAvailable(res.available);
      if (!res.available) {
        setUsernameError('Username already taken by another operator');
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [username, checkUsername]);

  const getFullTarget = () => {
    if (authMethod === 'PHONE') {
      const trimmed = rawPhoneNumber.trim();
      if (trimmed.startsWith('+')) {
        return trimmed.replace(/[^\d+]/g, '');
      }
      const cleanedDigits = trimmed.replace(/\D/g, '');
      const codeDigits = countryCode.replace(/\D/g, '');
      if (cleanedDigits.startsWith(codeDigits) && cleanedDigits.length > codeDigits.length + 7) {
        return `+${cleanedDigits}`;
      }
      return `${countryCode}${cleanedDigits}`;
    }
    return email.trim().toLowerCase();
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const target = getFullTarget();
    if (authMethod === 'PHONE' && (!rawPhoneNumber.trim() || rawPhoneNumber.replace(/\D/g, '').length < 6)) {
      setErrorMsg('ENTER A VALID MOBILE PHONE NUMBER');
      return;
    }
    if (authMethod === 'EMAIL' && (!email.trim() || !email.includes('@'))) {
      setErrorMsg('ENTER A VALID EMAIL ADDRESS');
      return;
    }

    const res = await sendOtp(target, authMethod);
    if (res.success) {
      setCooldown(res.cooldownSeconds || 60);
      if (res.devCode) {
        setDevCode(res.devCode);
      }
      setOtpDigits(['', '', '', '', '', '']);
      setStep('OTP');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } else {
      setErrorMsg(res.error?.toUpperCase() || 'LINK_FAIL: UNABLE TO DISPATCH CODE');
    }
  };

  // Step 2: Handle OTP Digits change
  const handleOtpChange = (index: number, val: string) => {
    const char = val.slice(-1); // last char
    if (char && !/^\d$/.test(char)) return;

    const updated = [...otpDigits];
    updated[index] = char;
    setOtpDigits(updated);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (char && index === 5 && updated.every((d) => d !== '')) {
      handleVerifyOtp(updated.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').trim().replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      const digits = paste.split('');
      setOtpDigits(digits);
      otpInputRefs.current[5]?.focus();
      handleVerifyOtp(paste);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    setErrorMsg('');
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg('ENTER ALL 6 DIGITS OF THE VERIFICATION CODE');
      return;
    }

    const target = getFullTarget();
    const res = await verifyOtp(target, code);

    if (res.success) {
      if (res.isNewUser) {
        // Go to Telegram profile completion
        setStep('PROFILE');
      }
      // If not new user, useAuthStore already logged in and App.tsx will route to chat automatically!
    } else {
      setErrorMsg(res.error?.toUpperCase() || 'LINK_FAIL: INVALID OR EXPIRED CODE');
    }
  };

  // Step 3: Complete Profile Setup
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeTicket) {
      setErrorMsg('TICKET EXPIRED: PLEASE RESTART VERIFICATION');
      setStep('INPUT');
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('USERNAME MUST BE AT LEAST 3 CHARACTERS');
      return;
    }
    if (!usernameAvailable) {
      setErrorMsg('PLEASE CHOOSE AN AVAILABLE USERNAME');
      return;
    }

    const success = await registerProfile(
      activeTicket,
      cleanUsername,
      displayName.trim() || cleanUsername,
      profilePassword.trim() || undefined
    );

    if (!success) {
      setErrorMsg(useAuthStore.getState().authError?.toUpperCase() || 'PROFILE_CREATION_FAILED');
    }
  };

  // Step 4: Legacy Password Login
  const handleLegacyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!legacyIdentifier || !legacyPassword) {
      setErrorMsg('ALL FIELDS ARE REQUIRED');
      return;
    }

    const success = await login(legacyIdentifier.trim().toLowerCase(), legacyPassword);
    if (!success) {
      setErrorMsg(useAuthStore.getState().authError?.toUpperCase() || 'LINK_FAIL: INVALID CREDENTIALS');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-black bg-dot-grid text-white overflow-hidden font-sans select-none p-4">
      {/* Nothing OS Minimalist Panel */}
      <div className="relative z-10 w-full max-w-md p-8 bg-black border border-white rounded-none shadow-2xl animate-fade-snap">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 border border-white text-white mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-mono font-black uppercase tracking-[0.25em] text-white">
            NEXUS_SYSTEM
          </h1>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1">
            {step === 'INPUT' && 'TELEGRAM-GRADE SECURE COMM LINK'}
            {step === 'OTP' && 'CODE_AUTHENTICATION'}
            {step === 'PROFILE' && 'ENROLL OPERATOR IDENTITY'}
            {step === 'LEGACY' && 'CLASSIC CONSOLE LOGIN'}
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-5 p-3 bg-zinc-950 border border-red-500 text-red-400 font-mono text-[10px] uppercase tracking-wider leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: TARGET INPUT (PHONE / EMAIL) */}
        {step === 'INPUT' && (
          <div>
            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-1 mb-5 p-1 bg-zinc-950 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('PHONE');
                  setErrorMsg('');
                }}
                className={`py-2 text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                  authMethod === 'PHONE'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                PHONE
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('EMAIL');
                  setErrorMsg('');
                }}
                className={`py-2 text-[11px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                  authMethod === 'EMAIL'
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                EMAIL
              </button>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              {authMethod === 'PHONE' ? (
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                    MOBILE PHONE NUMBER
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-28 py-2.5 px-2 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white rounded-none cursor-pointer"
                    >
                      {COMMON_COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.country})
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        value={rawPhoneNumber}
                        onChange={(e) => setRawPhoneNumber(e.target.value)}
                        placeholder="234 567 8900"
                        autoFocus
                        className="w-full py-2.5 px-3.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white tracking-wider rounded-none"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] font-mono text-zinc-500">
                    We will send a 6-digit confirmation code via SMS.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@nexus.chat"
                      autoFocus
                      className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white tracking-wider rounded-none"
                    />
                  </div>
                  <p className="text-[9px] font-mono text-zinc-500">
                    We will send a 6-digit confirmation code via Email.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 mt-4 bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition duration-75 flex items-center justify-center gap-2 group disabled:opacity-50 uppercase tracking-widest"
              >
                {isAuthenticating ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-none animate-spin" />
                ) : (
                  <>
                    SEND VERIFICATION CODE
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom links */}
            <div className="mt-6 pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono">
              <span className="text-zinc-500 uppercase">HAVE A PASSKEY?</span>
              <button
                type="button"
                onClick={() => {
                  setStep('LEGACY');
                  setErrorMsg('');
                }}
                className="text-white hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                PASSKEY LOGIN
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
        {step === 'OTP' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-xs font-mono text-zinc-300">
                Enter the 6-digit code sent to:
              </p>
              <p className="text-sm font-mono font-bold text-white mt-1 tracking-wider">
                {getFullTarget()}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('INPUT');
                  setErrorMsg('');
                }}
                className="text-[10px] font-mono text-zinc-500 hover:text-white underline mt-1 tracking-wider uppercase"
              >
                Change {authMethod === 'PHONE' ? 'Phone Number' : 'Email'}
              </button>
            </div>

            {/* Dev Mode Code Helper Banner */}
            {devCode && (
              <div className="p-3 bg-zinc-950 border border-emerald-500/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[9px] uppercase tracking-wider font-bold">
                    <Sparkles className="w-3 h-3" />
                    LOCAL DEV CODE AVAILABLE
                  </div>
                  <div className="font-mono text-base font-bold text-white tracking-[0.3em] mt-0.5">
                    {devCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const digits = devCode.split('');
                    setOtpDigits(digits);
                    handleVerifyOtp(devCode);
                  }}
                  className="px-2.5 py-1.5 bg-emerald-500 text-black font-mono font-bold text-[10px] uppercase hover:bg-emerald-400"
                >
                  AUTO FILL
                </button>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpInputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-12 text-center text-lg font-mono font-black bg-zinc-950 border border-zinc-800 focus:border-white text-white rounded-none focus:outline-none transition"
                />
              ))}
            </div>

            <button
              type="button"
              disabled={isAuthenticating || otpDigits.some((d) => !d)}
              onClick={() => handleVerifyOtp()}
              className="w-full py-3 bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition duration-75 flex items-center justify-center gap-2 group disabled:opacity-40 uppercase tracking-widest"
            >
              {isAuthenticating ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-none animate-spin" />
              ) : (
                <>
                  CONFIRM CODE
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

            {/* Resend Action */}
            <div className="text-center pt-2">
              {cooldown > 0 ? (
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  RESEND CODE IN {cooldown}S
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  className="text-[10px] font-mono text-white hover:underline font-bold uppercase tracking-wider"
                >
                  RESEND CODE NOW
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: NEW USER TELEGRAM PROFILE SETUP */}
        {step === 'PROFILE' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-emerald-400 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                PHONE/EMAIL VERIFIED
              </div>
              <h2 className="text-sm font-mono font-bold uppercase text-white tracking-wider">
                CHOOSE YOUR TELEGRAM HANDLE
              </h2>
            </div>

            {/* Alphanumeric @Username */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                  PUBLIC @USERNAME
                </label>
                {usernameChecking && (
                  <span className="text-[9px] font-mono text-zinc-500 animate-pulse">CHECKING...</span>
                )}
                {!usernameChecking && usernameAvailable === true && (
                  <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" /> AVAILABLE
                  </span>
                )}
                {!usernameChecking && usernameAvailable === false && (
                  <span className="text-[9px] font-mono text-red-400 flex items-center gap-1 font-bold">
                    <XCircle className="w-3 h-3" /> UNAVAILABLE
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 font-mono font-bold text-sm">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                  placeholder="cyber_operator"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`w-full pl-8 pr-4 py-2.5 bg-zinc-950 border text-xs font-mono text-white rounded-none tracking-wide transition ${
                    usernameAvailable === true
                      ? 'border-emerald-500'
                      : usernameAvailable === false
                      ? 'border-red-500'
                      : 'border-zinc-800 focus:border-white'
                  }`}
                />
              </div>
              {usernameError ? (
                <p className="text-[9px] font-mono text-red-400">{usernameError}</p>
              ) : (
                <p className="text-[9px] font-mono text-zinc-500">
                  People can find and message you using your unique @username.
                </p>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                DISPLAY NAME
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Operator One"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white rounded-none tracking-wide"
                />
              </div>
            </div>

            {/* Optional Backup Passkey */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                  BACKUP PASSKEY (OPTIONAL)
                </label>
                <span className="text-[9px] font-mono text-zinc-600">FOR DIRECT LOGINS</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white rounded-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || !usernameAvailable}
              className="w-full py-3 mt-4 bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition duration-75 flex items-center justify-center gap-2 group disabled:opacity-40 uppercase tracking-widest"
            >
              {isAuthenticating ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-none animate-spin" />
              ) : (
                <>
                  COMPLETE PROFILE & ENTER
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 4: LEGACY PASSKEY LOGIN */}
        {step === 'LEGACY' && (
          <form onSubmit={handleLegacyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                USERNAME OR EMAIL
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={legacyIdentifier}
                  onChange={(e) => setLegacyIdentifier(e.target.value)}
                  placeholder="USERNAME OR EMAIL"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white uppercase rounded-none tracking-wide"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                PASSKEY
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={legacyPassword}
                  onChange={(e) => setLegacyPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-white text-xs font-mono text-white rounded-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 mt-4 bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition duration-75 flex items-center justify-center gap-2 group disabled:opacity-50 uppercase tracking-widest"
            >
              {isAuthenticating ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-none animate-spin" />
              ) : (
                <>
                  LOGIN TO CONSOLE
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-zinc-900 text-center">
              <button
                type="button"
                onClick={() => {
                  setStep('INPUT');
                  setErrorMsg('');
                }}
                className="text-[10px] font-mono text-zinc-400 hover:text-white font-bold uppercase tracking-wider flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                BACK TO OTP SIGN IN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
