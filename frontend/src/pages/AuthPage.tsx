import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { MessageSquare, Mail, Lock, User, ArrowRight } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const { login, register, isAuthenticating } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isLogin) {
      if (!username || !password) {
        setErrorMsg('ALL FIELDS ARE REQUIRED');
        return;
      }
      const sanitizedUsername = username.trim().toLowerCase();
      const success = await login(sanitizedUsername, password);
      if (!success) {
        setErrorMsg(useAuthStore.getState().authError?.toUpperCase() || 'LINK_FAIL: INVALID CREDENTIALS');
      }
    } else {
      if (!username || !email || !password) {
        setErrorMsg('ALL FIELDS ARE REQUIRED');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('INSUFFICIENT SECURITY: PASSWORD MUST BE >= 6 CHARS');
        return;
      }
      const sanitizedUsername = username.trim().toLowerCase();
      const sanitizedEmail = email.trim().toLowerCase();
      const success = await register(sanitizedUsername, sanitizedEmail, password);
      if (!success) {
        setErrorMsg(useAuthStore.getState().authError?.toUpperCase() || 'LINK_FAIL: REGISTRATION DENIED');
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-black bg-dot-grid text-white overflow-hidden font-sans rounded-none select-none">
      
      {/* Nothing OS Stark Auth Panel */}
      <div className="relative z-10 w-full max-w-sm mx-4 p-8 bg-black border border-white rounded-none shadow-none animate-scale-in">
        
        {/* Console Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-10 h-10 border border-white text-white mb-4">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-mono font-black uppercase tracking-[0.2em] text-white">
            NEXUS_SYSTEM
          </h1>
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
            {isLogin ? 'ESTABLISH CONS_OPERATOR LINK...' : 'REGISTER NEW CONSOLE ID...'}
          </p>
        </div>

        {/* Console Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-zinc-950 border border-red-500 text-red-500 font-mono text-[9px] uppercase tracking-wider leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
              {isLogin ? 'OP_USER_OR_EMAIL' : 'OP_USERNAME'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-2.5 rounded-none bg-zinc-950 border border-zinc-900 focus:border-white text-xs font-mono uppercase tracking-wide transition"
                placeholder={isLogin ? 'ENTER USER ID...' : 'CHOOSE USER ID...'}
              />
            </div>
          </div>

          {/* Email Input (Register Only) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
                OP_EMAIL
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full pl-10 pr-4 py-2.5 rounded-none bg-zinc-950 border border-zinc-900 focus:border-white text-xs font-mono uppercase tracking-wide transition"
                  placeholder="EMAIL@DOMAIN.COM"
                />
              </div>
            </div>
          )}

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">
              OP_PASSKEY
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-none bg-zinc-950 border border-zinc-900 focus:border-white text-xs font-mono transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3 mt-2 rounded-none bg-white text-black font-mono font-black text-xs border border-white hover:bg-black hover:text-white transition duration-75 flex items-center justify-center gap-2 group disabled:opacity-50 btn-interactive uppercase tracking-widest"
          >
            {isAuthenticating ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-none animate-spin"></span>
            ) : (
              <>
                {isLogin ? 'CONNECT_LINK' : 'INITIALIZE_OP'}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Account State */}
        <div className="mt-6 text-center text-[10px] font-mono">
          <span className="text-zinc-500 uppercase tracking-wider">
            {isLogin ? "NO ACTIVE CONSOLE PROFILE? " : 'CONSOLE ID ALREADY ENROLLED? '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setUsername('');
              setEmail('');
              setPassword('');
              setErrorMsg('');
            }}
            className="text-white hover:underline font-bold ml-1 uppercase transition tracking-widest"
          >
            {isLogin ? 'SIGN_UP' : 'LOG_IN'}
          </button>
        </div>

      </div>
    </div>
  );
};
