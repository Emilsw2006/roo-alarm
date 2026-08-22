import React, { createContext, useContext } from 'react';

const MainAppReadyContext = createContext(false);

export function MainAppReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  return (
    <MainAppReadyContext.Provider value={ready}>{children}</MainAppReadyContext.Provider>
  );
}

export function useMainAppReady() {
  return useContext(MainAppReadyContext);
}
