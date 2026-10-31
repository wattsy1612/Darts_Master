export default function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    score:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 4h.01',
    history: 'M5 5h14v15H5zM8 2v6m8-6v6M8 12h8m-8 4h5',
    players:
      'M15.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',
    data: 'M5 4h14v16H5zM8 4v6h8V4M8 20v-6h8v6',
    roadmap: 'M5 21V3m0 1c5-4 9 4 14 0v9c-5 4-9-4-14 0',
  };
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.score} />
    </svg>
  );
}
