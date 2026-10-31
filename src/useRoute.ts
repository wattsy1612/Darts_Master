import { useCallback, useEffect, useState } from 'react';
export type Route = 'score' | 'history' | 'players' | 'roadmap' | 'ui' | 'data';
const paths: Record<Route, string> = {
  score: 'play',
  history: 'history',
  players: 'players',
  roadmap: 'roadmap',
  ui: 'design-system',
  data: 'data',
};
function read(): Route {
  const slug = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return (
    (Object.keys(paths) as Route[]).find(
      (route) =>
        paths[route] === slug && (route !== 'ui' || import.meta.env.DEV),
    ) ?? 'score'
  );
}
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const update = () => setRoute(read());
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);
  const navigate = useCallback((next: Route) => {
    if (next === 'ui' && !import.meta.env.DEV) return;
    const hash = `#/${paths[next]}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setRoute(next);
  }, []);
  return [route, navigate];
}
