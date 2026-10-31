import type { Route } from '../useRoute';
export default function MatchPageLinks({
  pages,
  current,
  onNavigate,
}: {
  pages: readonly (readonly [Route, string])[];
  current: Route;
  onNavigate: (route: Route) => void;
}) {
  return pages.map(([route, label]) => (
    <button
      key={route}
      type="button"
      aria-current={current === route ? 'page' : undefined}
      onClick={(e) => {
        onNavigate(route);
        e.currentTarget.closest('details')?.removeAttribute('open');
      }}
    >
      {label}
    </button>
  ));
}
