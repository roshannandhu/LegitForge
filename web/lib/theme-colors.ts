/** Each theme's page background, as hex for places CSS tokens can't reach before or across a
 *  theme swap: the browser chrome (layout.tsx themeColor) and the lite theme fade
 *  (forge-lever.tsx). Keep in step with --bg in app/globals.css. */
export const PAGE_BG = { dark: '#151A20', light: '#E8ECEF' } as const;
