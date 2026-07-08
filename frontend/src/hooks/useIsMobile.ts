import { Grid } from 'antd';
import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 768) {
  const screens = Grid.useBreakpoint();
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screens.md === false || viewportWidth <= breakpoint;
}
