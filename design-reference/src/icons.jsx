// Icons — custom thin-stroke (1.5px), Reis Magos green/ink
// Used as <Icon name="home" size={18} />

const ICONS = {
  home: 'M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-8.5z',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zm5-6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  qr: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h3v3h-3v-3zm6 0h1v1h-1v-1zm-6 6h7v1h-7v-1zm6-3h1v3h-1v-3z',
  calendar: 'M7 3v3M17 3v3M3 9h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  pot: 'M5 10h14l-1 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 10zM4 7h16M9 4v3M15 4v3',
  truck: 'M3 7h11v9H3V7zm11 3h4l3 3v3h-7v-6zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  calc: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 4h10v3H7V7zm0 5h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 16h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v5h-2v-5z',
  diamond: 'M6 3h12l3 6-9 12L3 9l3-6zM3 9h18M9 3l3 6 3-6',
  report: 'M5 3h10l4 4v14H5V3zm10 0v4h4M8 12h8M8 16h6',
  box: 'M3 8l9-5 9 5v9l-9 5-9-5V8zm0 0l9 5m0 0l9-5m-9 5v10',
  group: 'M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm9 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 21a6 6 0 0 1 12 0M12 21a6 6 0 0 1 9-1.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 21a7 7 0 0 1 14 0M16 14a5 5 0 0 1 6 7',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5l1.5 1.2-1.5 2.6-1.9-.4a7 7 0 0 1-2 1.2l-.5 1.9h-3l-.5-1.9a7 7 0 0 1-2-1.2l-1.9.4L5 14.7l1.5-1.2a7 7 0 0 1 0-2.3L5 9.9l1.5-2.6 1.9.4a7 7 0 0 1 2-1.2l.5-1.9h3l.5 1.9a7 7 0 0 1 2 1.2l1.9-.4L20 9.9l-1.5 1.3a7 7 0 0 1 0 2.3z',
  print: 'M6 9V3h12v6M6 17H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7z',
  printer: 'M6 9V3h12v6M6 17H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v7M14 11v7',
  edit: 'M16 3l5 5L8 21H3v-5L16 3zm-3 3l5 5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm5.5-2L21 20',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5L20 7',
  chevR: 'M9 5l7 7-7 7',
  chevL: 'M15 5l-7 7 7 7',
  chevD: 'M5 9l7 7 7-7',
  chevU: 'M5 15l7-7 7 7',
  arrow: 'M5 12h14M13 5l7 7-7 7',
  x: 'M6 6l12 12M6 18L18 6',
  alert: 'M12 3l10 18H2L12 3zm0 6v5m0 3v.5',
  warning: 'M12 3l10 18H2L12 3zm0 6v5m0 3v.5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-1.5-7c0-2 3-2.5 3-4.5a1.5 1.5 0 0 0-3-1M12 17v.5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  cam: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  flame: 'M12 22a6 6 0 0 0 6-6c0-3-2-5-3-7-1 2-2 3-3 3-1-2-2-4-2-7-3 3-6 6-6 11a6 6 0 0 0 6 6z',
  snow: 'M12 2v20M4 6l16 12M20 6L4 18M2 12h20',
  wind: 'M3 8h12a3 3 0 1 0-3-3M3 16h17a3 3 0 1 1-3 3M3 12h11',
  filter: 'M3 5h18l-7 9v5l-4 2v-7L3 5z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8zm5 13a2 2 0 0 0 2 0',
  trophy: 'M7 4h10v3a5 5 0 0 1-10 0V4zM4 4h3v3M17 4h3v3M9 14v4h6v-4M8 22h8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  fish: 'M2 12s3-5 9-5 9 5 9 5-3 5-9 5c-3 0-5.5-1.4-7-3l-3 3v-10zM16 12h.01',
  beef: 'M5 8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm4 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wheat: 'M12 2v20M8 6c0 2 1.5 4 4 4M16 6c0 2-1.5 4-4 4M8 11c0 2 1.5 4 4 4M16 11c0 2-1.5 4-4 4M8 16c0 2 1.5 4 4 4M16 16c0 2-1.5 4-4 4',
  cheese: 'M3 14l8-9 10 4v9H3v-4zm5 0h.01M12 14h.01M16 14h.01',
  bottle: 'M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2V2zM10 12h4',
  carrot: 'M3 21l8-8 4 4-8 8H3v-4zM12 12l3-3a4 4 0 1 1 0-6 4 4 0 0 1 0 6',
  utensils: 'M3 2v7a3 3 0 0 0 3 3v9M9 2v7a3 3 0 0 1-3 3M15 2c0 5 3 6 3 9v10M18 2v8',
  shield: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z',
  package: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4 9-4M12 11v10',
  layers: 'M12 2L3 7l9 5 9-5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  lock: 'M5 11h14v10H5V11zm2 0V7a5 5 0 0 1 10 0v4',
  star: 'M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z',
};

function Icon({ name, size = 18, stroke = 1.5, fill = 'none', className = '', style = {} }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

window.Icon = Icon;
window.ICONS = ICONS;
