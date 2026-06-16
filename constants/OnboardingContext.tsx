import React, { createContext, useContext, useState } from 'react';

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
  soundSettings?: any;
  userName?: string;
  gender?: string;
}

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
  const [data, setData] = useState<OnboardingData>({});

  const updateData = (newData: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetData = () => setData({});

  return (
    <OnboardingContext.Provider value={{ data, updateData, resetData }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => useContext(OnboardingContext);
