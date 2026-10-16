'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Persistent in-memory cache to prevent layout-shift / blink across route changes
let cachedCollapsedState: boolean = false;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Initialize to false so SSR HTML and initial client hydration HTML match
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(false);

  // Sync stored preference from localStorage after initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed') === 'true';
      if (saved) {
        cachedCollapsedState = true;
        setIsCollapsedState(true);
      }
    } catch {
      // quiet fallback
    }
  }, []);

  // Sync HTML attribute and localStorage on state change
  useEffect(() => {
    cachedCollapsedState = isCollapsed;
    try {
      localStorage.setItem('sidebar_collapsed', String(isCollapsed));
      document.documentElement.setAttribute('data-sidebar-collapsed', String(isCollapsed));
    } catch {
      // quiet fallback
    }
  }, [isCollapsed]);

  // Listen to cross-tab storage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sidebar_collapsed' && e.newValue !== null) {
        const val = e.newValue === 'true';
        cachedCollapsedState = val;
        setIsCollapsedState(val);
        document.documentElement.setAttribute('data-sidebar-collapsed', String(val));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      cachedCollapsedState = next;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
        document.documentElement.setAttribute('data-sidebar-collapsed', String(next));
      } catch {
        // quiet fallback
      }
      return next;
    });
  }, []);

  const setIsCollapsed = useCallback((val: boolean) => {
    cachedCollapsedState = val;
    setIsCollapsedState(val);
    try {
      localStorage.setItem('sidebar_collapsed', String(val));
      document.documentElement.setAttribute('data-sidebar-collapsed', String(val));
    } catch {
      // quiet fallback
    }
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setIsCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return {
      isCollapsed: cachedCollapsedState,
      toggleSidebar: () => {},
      setIsCollapsed: () => {},
    };
  }
  return context;
}
