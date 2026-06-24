import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageSquare, Plus, Compass, LogOut } from 'lucide-react';

export const SidebarServers: React.FC = () => {
  const { servers, activeServerId, setActiveServerId, setActiveMode, activeMode, createServer, joinServer } = useChatStore();
  const { logout } = useAuthStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setIsLoading(true);
    const success = await createServer(serverName.trim());
    setIsLoading(false);
    if (success) {
      setServerName('');
      setShowCreateModal(false);
    }
  };

  const handleJoinServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsLoading(true);
    const success = await joinServer(inviteCode.trim());
    setIsLoading(false);
    if (success) {
      setInviteCode('');
      setShowJoinModal(false);
    }
  };

  return (
    <div className="w-[72px] h-screen bg-[#07080b] flex flex-col items-center py-3 justify-between border-r border-white/5 select-none">
      
      {/* Upper actions */}
      <div className="flex flex-col gap-2 w-full items-center">
        
        {/* DM Icon */}
        <button
          onClick={() => setActiveMode('DM')}
          className={`relative group flex items-center justify-center w-12 h-12 rounded-3xl hover:rounded-2xl transition-all duration-300 ${
            activeMode === 'DM'
              ? 'bg-brand-500 text-white rounded-2xl'
              : 'bg-dark-800 text-dark-500 hover:bg-brand-500 hover:text-white'
          }`}
        >
          {/* Active side indicator */}
          <div className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-300 ${
            activeMode === 'DM' ? 'h-5' : 'h-0 group-hover:h-3'
          }`} />
          <MessageSquare className="w-5 h-5" />
          
          {/* Tooltip */}
          <div className="absolute left-[80px] hidden group-hover:block z-50 glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl">
            Direct Messages
          </div>
        </button>

        <div className="w-8 h-[2px] bg-dark-600/50 rounded my-1" />

        {/* Server List */}
        <div className="flex flex-col gap-2 w-full items-center overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-none">
          {servers.map((server) => {
            const isActive = activeMode === 'SERVER' && activeServerId === server.id;
            const initials = server.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <button
                key={server.id}
                onClick={() => setActiveServerId(server.id)}
                className={`relative group flex items-center justify-center w-12 h-12 rounded-3xl hover:rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-500 text-white rounded-2xl'
                    : 'bg-dark-800 text-dark-500 hover:bg-brand-500 hover:text-white'
                }`}
              >
                {/* Active side indicator */}
                <div className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-300 ${
                  isActive ? 'h-10' : 'h-0 group-hover:h-5'
                }`} />

                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover rounded-3xl hover:rounded-2xl transition-all"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-wider">{initials}</span>
                )}

                {/* Tooltip */}
                <div className="absolute left-[80px] hidden group-hover:block z-50 glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl">
                  {server.name}
                </div>
              </button>
            );
          })}
        </div>

        <div className="w-8 h-[2px] bg-dark-600/50 rounded my-1" />

        {/* Add Server */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="group flex items-center justify-center w-12 h-12 rounded-3xl hover:rounded-2xl bg-dark-800 text-accent-green hover:bg-accent-green hover:text-dark-900 transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          <div className="absolute left-[80px] hidden group-hover:block z-50 glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl">
            Create Server
          </div>
        </button>

        {/* Join Server */}
        <button
          onClick={() => setShowJoinModal(true)}
          className="group flex items-center justify-center w-12 h-12 rounded-3xl hover:rounded-2xl bg-dark-800 text-accent-cyan hover:bg-accent-cyan hover:text-dark-900 transition-all duration-300"
        >
          <Compass className="w-5 h-5" />
          <div className="absolute left-[80px] hidden group-hover:block z-50 glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl">
            Join Server
          </div>
        </button>
      </div>

      {/* Logout button at bottom */}
      <button
        onClick={logout}
        className="group flex items-center justify-center w-12 h-12 rounded-3xl hover:rounded-2xl bg-dark-800 text-accent-red hover:bg-accent-red hover:text-white transition-all duration-300"
      >
        <LogOut className="w-5 h-5" />
        <div className="absolute left-[80px] hidden group-hover:block z-50 glass-panel px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-xl">
          Log Out
        </div>
      </button>

      {/* Create Server Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Create Server</h2>
            <p className="text-xs text-dark-500 mb-4">Provide a name to initialize your server workspace.</p>
            <form onSubmit={handleCreateServer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Server Name
                </label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. Valheim Crew"
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-accent-green hover:bg-accent-green/80 text-dark-900 text-xs font-bold transition flex items-center justify-center"
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Server Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Join Server</h2>
            <p className="text-xs text-dark-500 mb-4">Enter an 8-character invite code to join a workspace.</p>
            <form onSubmit={handleJoinServer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-500 mb-1.5">
                  Invite Code
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. 7f9208a1"
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input uppercase tracking-wider text-center"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-accent-cyan hover:bg-accent-cyan/85 text-dark-900 text-xs font-bold transition flex items-center justify-center"
                >
                  {isLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
