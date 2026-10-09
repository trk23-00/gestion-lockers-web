export type IconName = "package" | "calendar" | "check" | "clock" | "door" | "users" | "truck" | "wallet" | "bell";
const paths: Record<IconName, string> = {
  package: "M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4 9-4M12 11v10M7 5l10 4",
  calendar: "M5 5h14v16H5V5zm3-3v6m8-6v6M5 10h14M8 14h2m4 0h2m-8 3h2m4 0h2",
  check: "M9 3h6l6 6v6l-6 6H9l-6-6V9l6-6zm-2 9l3 3 7-7",
  clock: "M12 7v5h4M5 3L2 6m17-3l3 3M5 19l-2 3m16-3l2 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  door: "M13 3l7 2v15l-7 2V3zm-3 1H6v4m0 8v4h4M2 12h9m-3-3l3 3-3 3M16 11v3",
  users: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-4a4 4 0 0 1 0 8",
  truck: "M1 5h13v12H1V5zm13 4h5l4 5v3h-9M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m13 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  wallet: "M20 8V5H5a2 2 0 0 0 0 4h15v11H5a2 2 0 0 1-2-2V7m17 5h-5v5h5m-2-2.5h.01",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1",
};
export default function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
