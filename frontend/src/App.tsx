import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { Radio } from 'lucide-react';

function App() {
  const { loadUser, isAuthenticated, isAuthenticating } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isAuthenticating && !isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-[#0b0c10] flex flex-col items-center justify-center gap-4 text-slate-300 font-sans">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.4)] animate-bounce">
          <Radio className="w-8 h-8 text-white" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-dark-500 animate-pulse">
          Synchronizing Nexus Operator...
        </span>
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <AuthPage />;
}

export default App;
