import React, { createContext, useContext } from 'react';
import useRaceDayManager from '@/hooks/useRaceDayManager';

const RaceDayContext = createContext(null);
export function RaceDayProvider({ children }) { const value = useRaceDayManager(); return <RaceDayContext.Provider value={value}>{children}</RaceDayContext.Provider>; }
export function useRaceDay() { const value = useContext(RaceDayContext); if (!value) throw new Error('useRaceDay must be used within RaceDayProvider'); return value; }