import { useState } from 'react';
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
        setErrorMsg('Please fill in all fields');
        return;
      }
      const sanitizedUsername = username.trim().toLowerCase();
      const success = await login(sanitizedUsername, password);
      if (!success) {
        setErrorMsg(useAuthStore.getState().authError || 'Login failed');
      }
    } else {
      if (!username || !email || !password) {
        setErrorMsg('Please fill in all fields');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long');
        return;
      }
      const sanitizedUsername = username.trim().toLowerCase();
      const sanitizedEmail = email.trim().toLowerCase();
      const success = await register(sanitizedUsername, sanitizedEmail, password);
      if (!success) {
        setErrorMsg(useAuthStore.getState().authError || 'Registration failed');
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0b0c10] text-[#e5e7eb] overflow-hidden font-sans">
      {/* Floating neon gradients for visual richness */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500 rounded-full mix-blend-screen filter blur-[120px] opacity-25 animate-pulse duration-10000"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-cyan rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse duration-[8000ms]"></div>
      
      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl glass-panel shadow-2xl transition-all duration-350">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-cyan shadow-[0_0_20px_rgba(99,102,241,0.5)] mb-4 animate-bounce duration-3000">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-accent-cyan bg-clip-text text-transparent">
            NEXUS
          </h1>
          <p className="text-sm text-dark-500 mt-1">
            {isLogin ? 'Welcome back, operator.' : 'Initialize your operator profile.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* Username / Email Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">
              {isLogin ? 'Username or Email' : 'Username'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-dark-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm transition-all"
                placeholder={isLogin ? 'admin' : 'saptak'}
              />
            </div>
          </div>

          {/* Email Field (Register Only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-dark-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm transition-all"
                  placeholder="saptak@nexus.com"
                />
              </div>
            </div>
          )}

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-dark-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-sm shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isAuthenticating ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                {isLogin ? 'Log In' : 'Create Account'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer toggler */}
        <div className="mt-6 text-center text-xs">
          <span className="text-dark-500">
            {isLogin ? "Don't have an operator profile? " : 'Already registered? '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setUsername('');
              setEmail('');
              setPassword('');
              setErrorMsg('');
            }}
            className="text-accent-cyan hover:underline font-semibold tracking-wide ml-1 focus:outline-none"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>

      </div>
    </div>
  );
};
