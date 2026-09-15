import { useState, useEffect } from 'react';

export const MOBILE_QUERY = '(max-width: 768px)';

export function useMediaQuery(query) {
  const getMatch = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    // Safari < 14 only supports addListener
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
