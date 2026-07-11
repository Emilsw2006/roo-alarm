let refreshListener: (() => void) | null = null;

export function setAuthNavigationRefreshListener(listener: (() => void) | null) {
  refreshListener = listener;
}

export function requestAuthNavigationRefresh() {
  refreshListener?.();
}
