import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Density = 'comfortable' | 'middle' | 'compact';
export type SidebarTheme = 'dark' | 'light';
export type ContentPadding = 'spacious' | 'standard' | 'compact';
export type TabStyle = 'card' | 'line';
export type HeaderStyle = 'solid' | 'glass';
export type PageTone = 'gray' | 'white';
export type LayoutMode = 'side' | 'top';

type AppearanceState = {
  primaryColor: string;
  borderRadius: number;
  density: Density;
  sidebarTheme: SidebarTheme;
  contentPadding: ContentPadding;
  tabStyle: TabStyle;
  headerStyle: HeaderStyle;
  pageTone: PageTone;
  layoutMode: LayoutMode;
  showBreadcrumb: boolean;
  showPageSearch: boolean;
  setPrimaryColor: (primaryColor: string) => void;
  setBorderRadius: (borderRadius: number) => void;
  setDensity: (density: Density) => void;
  setSidebarTheme: (sidebarTheme: SidebarTheme) => void;
  setContentPadding: (contentPadding: ContentPadding) => void;
  setTabStyle: (tabStyle: TabStyle) => void;
  setHeaderStyle: (headerStyle: HeaderStyle) => void;
  setPageTone: (pageTone: PageTone) => void;
  setLayoutMode: (layoutMode: LayoutMode) => void;
  setShowBreadcrumb: (showBreadcrumb: boolean) => void;
  setShowPageSearch: (showPageSearch: boolean) => void;
  reset: () => void;
};

const defaults = {
  primaryColor: '#1677ff',
  borderRadius: 6,
  density: 'middle' as Density,
  sidebarTheme: 'dark' as SidebarTheme,
  contentPadding: 'standard' as ContentPadding,
  tabStyle: 'card' as TabStyle,
  headerStyle: 'glass' as HeaderStyle,
  pageTone: 'gray' as PageTone,
  layoutMode: 'side' as LayoutMode,
  showBreadcrumb: true,
  showPageSearch: true,
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...defaults,
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setBorderRadius: (borderRadius) => set({ borderRadius }),
      setDensity: (density) => set({ density }),
      setSidebarTheme: (sidebarTheme) => set({ sidebarTheme }),
      setContentPadding: (contentPadding) => set({ contentPadding }),
      setTabStyle: (tabStyle) => set({ tabStyle }),
      setHeaderStyle: (headerStyle) => set({ headerStyle }),
      setPageTone: (pageTone) => set({ pageTone }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setShowBreadcrumb: (showBreadcrumb) => set({ showBreadcrumb }),
      setShowPageSearch: (showPageSearch) => set({ showPageSearch }),
      reset: () => set(defaults),
    }),
    { name: 'enterprise-demo-appearance-v1' },
  ),
);
