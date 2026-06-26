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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sleek radial glow effects */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/5 rounded-full filter blur-[100px] pointer-events-none"></div>
      
      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl shadow-2xl animate-scale-in">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-[0_0_20px_rgba(99,102,241,0.08)]">
            <MessageSquare className="w-5.5 h-5.5" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-outfit">
            NEXUS
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {isLogin ? 'Welcome back, operator.' : 'Initialize your operator profile.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] text-center font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Username / Email Field */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {isLogin ? 'Username or Email' : 'Username'}
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs font-medium"
                placeholder={isLogin ? 'admin' : 'saptak'}
              />
            </div>
          </div>

          {/* Email Field (Register Only) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Email Address
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs font-medium"
                  placeholder="saptak@nexus.com"
                />
              </div>
            </div>
          )}

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition duration-150 flex items-center justify-center gap-2 group disabled:opacity-50 btn-interactive"
          >
            {isAuthenticating ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                {isLogin ? 'Log In' : 'Create Account'}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer toggler */}
        <div className="mt-6 text-center text-xs">
          <span className="text-zinc-500 font-medium">
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
            className="text-indigo-400 hover:text-indigo-300 font-bold ml-0.5 transition"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>

      </div>
    </div>
  );
};
