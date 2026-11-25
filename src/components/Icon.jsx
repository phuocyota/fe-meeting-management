const paths = {
  calendar: 'M3 5h18v16H3zM3 10h18M7 2v6M17 2v6',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8',
  camera: 'M3 5h12v14H3zM15 10l6-4v12l-6-4',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8m6 9v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  chat: 'M21 11a9 9 0 0 1-9 9H3l1.6-4.5A9 9 0 1 1 21 11ZM8 10h8m-8 4h5',
  screen: 'M3 3h18v14H3zM8 21h8m-4-4v4m0-8V6m-3 3 3-3 3 3',
  hand: 'M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-7a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a1.5 1.5 0 0 1 2-2l3 2Z',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6L12 2Zm-4 9 3 3 5-5',
  gallery: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  speaker: 'M3 3h18v12H3zM3 19h4v3H3zm7 0h4v3h-4zm7 0h4v3h-4z',
  close: 'm6 6 12 12M6 18 18 6',
  leave: 'M10 4H3v16h7m4-12 4 4-4 4m-6-4h13',
  link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
  plus: 'M12 4v16M4 12h16',
}

export default function Icon({ name, off = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.camera} />
      {off && <path d="m2 2 20 20" strokeWidth="2.2" />}
    </svg>
  )
}
