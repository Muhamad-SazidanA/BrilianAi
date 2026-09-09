'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  hideHeader?: boolean;
}

export default function AppShell({
  children,
  title,
  subtitle,
  actions,
  noPadding = false,
  hideHeader = false,
}: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load saved sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // quiet fallback
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {
        // quiet fallback
      }
      return next;
    });
  };

  return (
    <div className="app-shell">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Content Area */}
      <div className={`app-main ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!hideHeader && <Header title={title} subtitle={subtitle} actions={actions} />}
        <main
          className="app-content"
          style={
            noPadding
              ? {
                  padding: 0,
                  maxWidth: 'none',
                  margin: 0,
                  height: hideHeader ? '100vh' : 'calc(100vh - var(--header-height))',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }
              : undefined
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
