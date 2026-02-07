'use client';

import React, { useState } from 'react';
import CharacterCreation from '@/components/CharacterCreation';
import GameTerminal from '@/components/GameTerminal';
import Lobby from '@/components/Lobby';
import { GameState, INITIAL_ROOMS, Player } from '@/lib/game-data';

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'lobby' | 'creation' | 'game'>('lobby');

  const handleCreateLobby = () => {
    // Generar un código aleatorio
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGameState({
      roomId: code,
      players: [],
      character: null,
      currentRoomId: 'start',
      worldState: {},
      history: [
        { role: 'assistant', content: INITIAL_ROOMS['start'].description }
      ],
      inCombat: false,
      isGameOver: false,
      gameStatus: 'playing'
    });
    setView('creation');
  };

  const handleJoinLobby = (code: string) => {
    setGameState({
      roomId: code,
      players: [],
      character: null,
      currentRoomId: 'start',
      worldState: {},
      history: [
        { role: 'assistant', content: INITIAL_ROOMS['start'].description }
      ],
      inCombat: false,
      isGameOver: false,
      gameStatus: 'playing'
    });
    setView('creation');
  };

  const startGame = (character: Player) => {
    setGameState(prev => prev ? {
      ...prev,
      character,
      players: [character]
    } : null);
    setView('game');
  };

  return (
    <main className="min-h-screen p-4 md:p-8 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-950/20 via-black to-black overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>

      <div className="z-10 w-full max-w-7xl h-full flex items-center justify-center">
        {view === 'lobby' && (
          <Lobby
            onJoin={handleJoinLobby}
            onCreate={handleCreateLobby}
          />
        )}

        {view === 'creation' && gameState && (
          <CharacterCreation onComplete={startGame} />
        )}

        {view === 'game' && gameState && (
          <GameTerminal state={gameState} setState={setGameState} />
        )}
      </div>
      <footer className="mt-8 z-10 text-[10px] text-gray-600 uppercase tracking-[0.5em] flex items-center gap-4">
        <span>ESTADO: {gameState ? 'EN LA MAZMORRA' : 'CONFIGURANDO AVENTURERO'}</span>
        <span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
        <span>V0.1.0-ALPHA</span>
      </footer>
    </main>
  );
}
