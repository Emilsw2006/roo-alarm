import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { PaletteKey, PALETTES, Palette } from './theme';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ThemeCtx {
  palette: PaletteKey;
  colors: Palette;
  setPalette: (key: PaletteKey) => void;
  streak: number;
  setStreak: (s: number) => void;
  weeklyHistory: boolean[];
  currentDayIndex: number;
  rescueTokens: number;
  longestStreak: number;
  showRescueModal: boolean;
  initialDataLoading: boolean;
  setShowRescueModal: (s: boolean) => void;
  useRescueToken: () => Promise<void>;
  acceptPunishment: () => Promise<void>;
  setRescueTokens: (n: number) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  palette: 'redWhite',
  colors: PALETTES.redWhite,
  setPalette: () => {},
  streak: 0,
  setStreak: () => {},
  weeklyHistory: Array(7).fill(false),
  currentDayIndex: 0,
  rescueTokens: 0,
  longestStreak: 0,
  showRescueModal: false,
  initialDataLoading: false,
  setShowRescueModal: () => {},
  useRescueToken: async () => {},
  acceptPunishment: async () => {},
  setRescueTokens: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<PaletteKey>('redWhite');
  const [streak, setStreakState] = useState<number>(0);
  const [weeklyHistory, setWeeklyHistory] = useState<boolean[]>(Array(7).fill(false));
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  
  const [rescueTokens, setRescueTokens] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  const [showRescueModal, setShowRescueModal] = useState<boolean>(false);
  const [initialDataLoading, setInitialDataLoading] = useState<boolean>(false);
  const [pendingPunishmentStreak, setPendingPunishmentStreak] = useState<number | null>(null);

  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      loadedUserId.current = null;
      setStreakState(0);
      setLongestStreak(0);
      setRescueTokens(0);
      setInitialDataLoading(false);
      return;
    }
    if (user.id === loadedUserId.current) return;
    loadedUserId.current = user.id;
    initData();
  }, [user]);

  const initData = async () => {
    setInitialDataLoading(true);
    try {
      // Necesitamos cargar settings primero para tener los tokens antes de loadStreak
      const { data } = await supabase.from('user_settings').select('rescue_tokens, longest_streak').eq('user_id', user!.id).single();
      let currentTokens = 0;
      if (data) {
        currentTokens = data.rescue_tokens || 0;
        setRescueTokens(currentTokens);
        setLongestStreak(data.longest_streak || 0);
      }
      await loadWeeklyHistory();
      await loadStreak(currentTokens);
    } finally {
      setInitialDataLoading(false);
    }
  };

  const loadWeeklyHistory = async () => {
    const today = new Date();
    let dayIndex = today.getDay() - 1;
    if (dayIndex === -1) dayIndex = 6;
    setCurrentDayIndex(dayIndex);

    const diffToMonday = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diffToMonday);
    const mondayStr = monday.toISOString().split('T')[0];

    const { data } = await supabase
      .from('streak_history')
      .select('date, streak_count')
      .eq('user_id', user!.id)
      .gte('date', mondayStr);

    const history = Array(7).fill(false);
    if (data) {
      data.forEach(row => {
        if (row.streak_count > 0) {
          const rowDate = new Date(row.date);
          let idx = rowDate.getDay() - 1;
          if (idx === -1) idx = 6;
          history[idx] = true;
        }
      });
    }
    setWeeklyHistory(history);
  };

  const getCheckpoint = (s: number) => {
    if (s >= 22) return 0; // Endgame caída libre
    if (s >= 18) return 13;
    if (s >= 13) return 8;
    if (s >= 8) return 4;
    if (s >= 4) return 1;
    return 0;
  };

  const loadStreak = async (currentTokens: number) => {
    const { data } = await supabase
      .from('streak_history')
      .select('streak_count, date')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastStreak = data[0].streak_count;
      const lastDateStr = data[0].date;

      if (!lastDateStr) {
        setStreakState(lastStreak);
        return;
      }

      const lastParts = lastDateStr.split('-');
      const lastUTC = Date.UTC(parseInt(lastParts[0], 10), parseInt(lastParts[1], 10) - 1, parseInt(lastParts[2], 10));
      
      const today = new Date();
      const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      
      const diffDays = Math.floor((todayUTC - lastUTC) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        if (currentTokens > 0) {
          setPendingPunishmentStreak(lastStreak);
          setShowRescueModal(true);
        } else {
          setStreakState(getCheckpoint(lastStreak));
        }
      } else {
        setStreakState(lastStreak);
      }
    } else {
      setStreakState(0);
    }
  };

  const useRescueToken = async () => {
    if (!user || pendingPunishmentStreak === null || rescueTokens <= 0) return;
    
    const newTokens = rescueTokens - 1;
    setRescueTokens(newTokens);
    setShowRescueModal(false);
    
    await supabase.from('user_settings').update({ rescue_tokens: newTokens }).eq('user_id', user.id);
    
    // Perdonar el día de ayer insertando un éxito ficticio
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    await supabase.from('streak_history').insert({
      user_id: user.id,
      date: yesterdayStr,
      streak_count: pendingPunishmentStreak,
    });
    
    setStreakState(pendingPunishmentStreak);
    setPendingPunishmentStreak(null);
    loadWeeklyHistory();
  };

  const acceptPunishment = async () => {
    if (pendingPunishmentStreak === null) return;
    const checkpoint = getCheckpoint(pendingPunishmentStreak);
    setShowRescueModal(false);
    setStreakState(checkpoint);

    // Persistir el castigo en el día actual evita que al reiniciar
    // loadStreak vuelva a detectar la misma caída como "pendiente".
    if (user) {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('streak_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .limit(1);

      if (data && data.length > 0) {
        await supabase
          .from('streak_history')
          .update({ streak_count: checkpoint })
          .eq('id', data[0].id);
      } else {
        await supabase
          .from('streak_history')
          .insert({
            user_id: user.id,
            date: todayStr,
            streak_count: checkpoint,
          });
      }
      await loadWeeklyHistory();
    }

    setPendingPunishmentStreak(null);
  };

  const setStreak = async (s: number) => {
    setStreakState(s);
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('streak_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .limit(1);

    if (data && data.length > 0) {
      await supabase.from('streak_history').update({ streak_count: s }).eq('id', data[0].id);
    } else {
      await supabase.from('streak_history').insert({
        user_id: user.id,
        date: todayStr,
        streak_count: s,
      });

      // Reward SaaS Logic if it's a genuine new day and not a reload
      let newTokens = rescueTokens;
      let newLongest = longestStreak;
      let settingsChanged = false;
      
      if (s > longestStreak) {
        newLongest = s;
        settingsChanged = true;
      }
      
      if (s > 0 && (s % 30 === 0 || s === 3)) {
        newTokens += 1;
        settingsChanged = true;
      }
      
      if (settingsChanged) {
        setRescueTokens(newTokens);
        setLongestStreak(newLongest);
        await supabase.from('user_settings').update({ rescue_tokens: newTokens, longest_streak: newLongest }).eq('user_id', user.id);
      }
    }
    
    // Sync with Widget
    import('../lib/widgetSync').then(m => m.syncWidgetStreak(s)).catch(() => {});
    
    setWeeklyHistory(() => {
      if (s <= 0) return Array(7).fill(false);
      
      const next = Array(7).fill(false);
      
      // Para hacer previews perfectas: si hay racha, llenamos siempre todos los días
      // de esta semana hasta el día actual, independientemente de la racha exacta.
      for (let i = 0; i <= currentDayIndex; i++) {
        next[i] = true;
      }
      
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ 
      palette, colors: PALETTES[palette], setPalette, 
      streak, setStreak, 
      weeklyHistory, currentDayIndex,
      rescueTokens, longestStreak,
      showRescueModal, initialDataLoading, setShowRescueModal,
      useRescueToken, acceptPunishment, setRescueTokens
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors() {
  return useContext(ThemeContext);
}
