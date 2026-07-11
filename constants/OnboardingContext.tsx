import React, { createContext, useContext, useState } from 'react';
import { DEFAULT_ENABLED_MISSIONS } from './missions';

interface OnboardingData {
  wakeUpThought?: string;
  stayInBedReason?: string;
  usualWakeTime?: Date;
  snoozeHabit?: string;
  alarmCount?: string;
  singleAlarmConfidence?: string;
  wakeUpFeeling?: string;
  missionType?: string;
  selectedMissions?: string[];
  wakeUpDuration?: string;
  targetWakeTime?: Date;
  protectedDays?: number[];
  userName?: string;
  gender?: string;
}

export type { OnboardingData };

interface OnboardingContextProps {
  data: OnboardingData;
  updateData: (newData: Partial<OnboardingData>) => void;
  resetData: () => void;
}

const OnboardingContext = createContext<OnboardingContextProps>({
  data: {},
  updateData: () => {},
  resetData: () => {},
});

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>({
    missionType: 'roulette',
    selectedMissions: DEFAULT_ENABLED_MISSIONS,
  });

  const updateData = (newData: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetData = () =>
    setData({
      missionType: 'roulette',
      selectedMissions: DEFAULT_ENABLED_MISSIONS,
    });

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => useContext(OnboardingContext);
