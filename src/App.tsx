import { useState, useEffect, useCallback } from 'react';
import { useConfigStore } from '@/state/configStore';
import Header from '@/ui/Header';
import SettingsModal from '@/ui/SettingsModal';
import LandingPage from '@/views/LandingPage';
import RoomPage from '@/views/RoomPage2';
import type { ParticipantRole } from '@/types';

interface RouteState {
  page: 'landing' | 'room';
  roomId?: string;
  role?: ParticipantRole;
}

function parseHash(): RouteState {
  const hash = window.location.hash;
  
  // Match #/room/ROOMID
  const roomMatch = hash.match(/^#\/room\/([A-Za-z0-9-]+)$/);
  if (roomMatch) {
    // Check if this is a new visitor (guest) or the host returning
    const roomId = roomMatch[1];
    const existingRole = sessionStorage.getItem(`room-role-${roomId}`);
    
    if (existingRole === 'host') {
      return { page: 'room', roomId, role: 'host' };
    }
    
    // Default to guest for anyone joining via link
    return { page: 'room', roomId, role: 'guest' };
  }
  
  return { page: 'landing' };
}

export default function App() {
  const { theme } = useConfigStore();
  const [route, setRoute] = useState<RouteState>(parseHash);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = useCallback((newRoute: RouteState) => {
    if (newRoute.page === 'room' && newRoute.roomId) {
      // Store the role for this room
      if (newRoute.role === 'host') {
        sessionStorage.setItem(`room-role-${newRoute.roomId}`, 'host');
      }
      window.location.hash = `/room/${newRoute.roomId}`;
    } else {
      window.location.hash = '';
    }
    setRoute(newRoute);
  }, []);

  const handleCreateRoom = useCallback(
    (roomId: string) => {
      navigateTo({ page: 'room', roomId, role: 'host' });
    },
    [navigateTo]
  );

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      navigateTo({ page: 'room', roomId, role: 'guest' });
    },
    [navigateTo]
  );

  const handleLeaveRoom = useCallback(() => {
    if (route.roomId) {
      sessionStorage.removeItem(`room-role-${route.roomId}`);
    }
    navigateTo({ page: 'landing' });
  }, [navigateTo, route.roomId]);

  // Load Web Speech API voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#010b13] text-gray-900 dark:text-white transition-colors duration-300">
      <Header
        showBackButton={route.page === 'room'}
        onBack={handleLeaveRoom}
      />
      <SettingsModal />

      {route.page === 'landing' && (
        <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      )}

      {route.page === 'room' && route.roomId && (
        <RoomPage
          key={`${route.roomId}-${route.role}`}
          roomId={route.roomId}
          role={route.role ?? 'guest'}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}
