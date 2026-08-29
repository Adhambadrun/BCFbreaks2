import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { X, Send, MessageSquare, User, Check, Shield } from 'lucide-react';
import { playSound } from '../../lib/sound';

export const MessagesPanel: React.FC = () => {
  const {
    isMessagesOpen,
    setIsMessagesOpen,
    currentUser,
    users,
    messages,
    sendMessage,
  } = useApp();

  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(() => {
    // Default to supervisor or admin
    return users.find(u => u.role === 'supervisor' && u.teamId === currentUser?.teamId)?.email || 'tarek.zaki@bcflights.com';
  });

  const [messageText, setMessageText] = useState('');

  if (!isMessagesOpen || !currentUser) return null;

  // Filter contacts based on RBAC matrix
  const contacts = users.filter(u => {
    if (u.email === currentUser.email) return false;
    if (currentUser.role === 'agent') {
      return u.role === 'supervisor' || u.role === 'admin' || u.role === 'developer';
    }
    if (currentUser.role === 'supervisor') {
      return u.teamId === currentUser.teamId || u.role === 'admin' || u.role === 'developer';
    }
    return true; // Admin & Developer can message all
  });

  const activeContact = users.find(u => u.email === selectedRecipient) || contacts[0];

  const convMessages = messages.filter(m =>
    (m.senderEmail === currentUser.email && m.recipientEmail === selectedRecipient) ||
    (m.senderEmail === selectedRecipient && m.recipientEmail === currentUser.email)
  );

  const handleSend = () => {
    if (messageText.trim() && selectedRecipient) {
      sendMessage(selectedRecipient, messageText.trim());
      setMessageText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xl">
      <GlassPanel
        material="thick"
        concentricRadius="none"
        className="w-full max-w-md h-full flex flex-col border-l border-white/15 p-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan" />
            <h2 className="font-orbitron font-bold text-base text-zinc-100">Private Shift Chat</h2>
          </div>
          <button onClick={() => setIsMessagesOpen(false)} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contacts Horizontal Scroller */}
        <div className="py-2.5 border-b border-white/10 overflow-x-auto flex gap-2 no-scrollbar">
          {contacts.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedRecipient(c.email);
                playSound('click');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-orbitron shrink-0 transition-all border ${
                selectedRecipient === c.email
                  ? 'bg-cyan/20 border-cyan text-cyan font-bold shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'bg-black/40 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <img
                src={c.avatarUrl}
                alt={c.name}
                className="w-4 h-4 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="truncate max-w-[80px]">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Active Contact Bar */}
        {activeContact && (
          <div className="py-2 flex items-center justify-between text-xs text-zinc-400 font-inter">
            <span>Chatting with <span className="text-zinc-100 font-semibold">{activeContact.name}</span> ({activeContact.role.toUpperCase()})</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 font-inter text-xs">
          {convMessages.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 italic">
              No messages in this shift thread yet. Start the conversation!
            </div>
          ) : (
            convMessages.map(m => {
              const isMe = m.senderEmail === currentUser.email;
              return (
                <div
                  key={m.messageId}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      isMe
                        ? 'bg-gradient-to-r from-crimson to-red-600 text-white rounded-br-none shadow-md'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/10'
                    }`}
                  >
                    {m.messageText}
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-0.5 px-1">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input bar */}
        <div className="pt-3 border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type message to supervisor / agent..."
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan"
          />
          <button
            onClick={handleSend}
            className="p-2.5 rounded-xl bg-cyan text-black hover:bg-cyan/90 transition-all font-bold shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </GlassPanel>
    </div>
  );
};
