/* ui_icons.js — original monochrome line-icon set (24-unit grid, stroke = currentColor)
   and the resolvers that map actions, spells, conditions, classes and creatures to icons. */
(function (G) {
'use strict';
const PF = G.PF;
const I = {};

/* ---------- helpers for generated shapes ---------- */
const gear = (cx, cy, r1, r2, n) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a0 = (i / (n * 2)) * Math.PI * 2 - Math.PI / (n * 2), a1 = ((i + 1) / (n * 2)) * Math.PI * 2 - Math.PI / (n * 2);
    const r = i % 2 ? r1 : r2;
    pts.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]);
  }
  return '<path d="M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z"/>';
};
const rays = (cx, cy, r1, r2, n, off = 0) => { let d = ''; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + off; d += 'M' + (cx + Math.cos(a) * r1).toFixed(2) + ' ' + (cy + Math.sin(a) * r1).toFixed(2) + 'L' + (cx + Math.cos(a) * r2).toFixed(2) + ' ' + (cy + Math.sin(a) * r2).toFixed(2); } return '<path d="' + d + '"/>'; };
const star4 = (cx, cy, r, w) => '<path d="M' + cx + ' ' + (cy - r) + 'L' + (cx + w) + ' ' + (cy - w) + 'L' + (cx + r) + ' ' + cy + 'L' + (cx + w) + ' ' + (cy + w) + 'L' + cx + ' ' + (cy + r) + 'L' + (cx - w) + ' ' + (cy + w) + 'L' + (cx - r) + ' ' + cy + 'L' + (cx - w) + ' ' + (cy - w) + 'Z"/>';
const F = 'class="f"'; // filled accent

/* ---------- weapons & strikes ---------- */
I.sword = '<path d="M4 4h2.6l9.6 9.6-2.6 2.6L4 6.6Z"/><path d="M11.6 18.4l6.8-6.8"/><path d="M15.4 15.4l3.6 3.6"/><circle cx="19.9" cy="19.9" r="1.2"/>';
I.axe = '<path d="M4 21L15.6 9.4"/><path d="M12.8 7.2L15.6 4.4C18.8 3.4 21.6 6.2 20.6 9.4L17.8 12.2Z"/>';
I.hammer = '<path d="M6 20.5l9-9"/><path d="M11.4 6.2l4.2-4.2 6.4 6.4-4.2 4.2Z"/><path d="M13.5 8.3l2.2 2.2"/>';
I.spear = '<path d="M4 20l12.5-12.5"/><path d="M15 5.2L20.6 3.4 18.8 9Z"/><path d="M6.5 15.5l2 2"/>';
I.dagger = '<path d="M12 2.5l2.2 3.3v8.2H9.8V5.8Z"/><path d="M7 14h10"/><path d="M12 14v5"/><circle cx="12" cy="20.6" r="1.4"/>';
I.bow = '<path d="M5 4Q19 5 20 19"/><path d="M5 4L20 19" stroke-dasharray="1.6 1.4"/><path d="M8.5 15.5L19 5"/><path d="M19 5l-3.6.5M19 5l-.5 3.6"/><path d="M8.5 15.5h-2.6M8.5 15.5v2.6"/>';
I.crossbow = '<path d="M4 8c4-4 12-4 16 0"/><path d="M4 8l8 4 8-4"/><path d="M12 3v18"/><path d="M10 18h4"/><path d="M12 3l-1.6 2.6M12 3l1.6 2.6"/>';
I.thrown = '<path d="M5 19L17.5 6.5"/><path d="M15.6 4.7L21 3l-1.7 5.4Z"/><path d="M3 14.5l4-4M8.5 21l3.5-3.5" opacity=".7"/>';
I.fist = '<path d="M6 11V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M9 10V7a1.5 1.5 0 0 1 3 0v3"/><path d="M12 10V7.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V9a1.5 1.5 0 0 1 3 0v4.6c0 3.6-2.6 6.4-6 6.4s-6-2.5-6-6V11"/><path d="M6 13.5h4.4a1.6 1.6 0 0 0 0-3.2H8.2"/>';
I.claw = '<path d="M5 3.5c3.2 4 4 9.5 1.8 16.5"/><path d="M10.5 3c3.2 4.5 4 10 1.8 18"/><path d="M16 3.5c3.2 4 4 9.5 1.8 16.5"/>';
I.jaws = '<path d="M3 9.5C7 4 17 4 21 9.5"/><path d="M3 14.5C7 20 17 20 21 14.5"/><path d="M6.5 8l1.6 4 1.4-4.9M11 6.6l1.4 4.4 1.4-4.4M15 7.1l1.5 4.2 1.2-3.6"/><path d="M7 16.2l1.5-3.6 1.4 4.4M11.2 17.4l1.3-4.3 1.4 4.3M15.3 16.8l1.3-3.9 1.3 3.2"/>';
I.horn = '<path d="M4 20c1-7 5-12 15-16-2 4-2.5 7-2 11"/><path d="M4 20c4-1 8-2.5 13-5"/><path d="M9 14.5l2 2M12 11.3l2 2"/>';
I.tail = '<path d="M3 18c4 2 9 1 12-3s2-9 6-11"/><path d="M19.5 2.5L21 4l-1.8.6Z"/>';
I.swords2 = '<path d="M4 4l11 11"/><path d="M12.6 17.4l4.8-4.8"/><path d="M15 15l4.5 4.5"/><path d="M20 4L9 15"/><path d="M6.6 12.6l4.8 4.8"/><path d="M9 15l-4.5 4.5"/>';
I.charge = '<path d="M9.5 12H21"/><path d="M21 12l-3-2.2v4.4Z"/><path d="M9.5 8.5v7"/><path d="M9.5 12H6.5"/><path d="M2 7.5h5M2 16.5h5M3.5 12H5" opacity=".7"/>';
I.lunge = '<path d="M3 15h11.5"/><path d="M14.5 15l6.5-3.5"/><path d="M14.5 12.5v5"/><path d="M5 9h8M17 7l2-2" opacity=".75"/><path d="M19.5 9.5l1.5-4-4 1.5"/>';
I.swipe = '<path d="M4 17C6 8 14 4 21 6"/><path d="M4 17l-.8-3.6M4 17l3.4-1.4"/><path d="M8 20c2-5 6-8 11-8.5" opacity=".6"/>';
I.arrows2 = '<path d="M3 13L15 4M15 4l-3.5.4M15 4l-.4 3.5"/><path d="M8 20l12-9M20 11l-3.5.4M20 11l-.4 3.5"/>';
I.arrows3 = '<path d="M2.5 11L12 3.5M12 3.5l-3.2.3M12 3.5l-.3 3.2"/><path d="M5.5 17.5L17 8.5M17 8.5l-3.2.3M17 8.5l-.3 3.2"/><path d="M10 21.5L21.5 13M21.5 13l-3.2.3M21.5 13l-.3 3.2"/>';
I.aim = '<circle cx="12" cy="12" r="7.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle ' + F + ' cx="12" cy="12" r="1.3"/>';
I.prey = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle ' + F + ' cx="12" cy="12" r="1.4"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>';
I.precise = '<path d="M4 4h2.6l9.6 9.6-2.6 2.6L4 6.6Z"/><path d="M11.6 18.4l6.8-6.8"/><circle cx="19" cy="5" r="2.6"/><circle ' + F + ' cx="19" cy="5" r=".9"/>';
I.hook = '<path d="M5 20.5l9-9"/><path d="M14 11.5c-2-2.5-1.5-6 1-7.5s6-.5 6.5 2.5c.4 2.4-1.5 4-3.5 3.5"/><path d="M18 10l-1.5-2.6"/>';
I.kick = '<circle cx="7" cy="5" r="2"/><path d="M7.5 7.5l2 5 5 1.5 6-3"/><path d="M9.5 12.5L6 17l-3 1"/><path d="M8 9l-4 1.5"/><path d="M17.5 7.5l2.5-1M18 11l3 1" opacity=".7"/>';
I.flurry = '<path d="M3 13.5V11a1.3 1.3 0 0 1 2.6 0v-1a1.3 1.3 0 0 1 2.6 0v1.5a1.3 1.3 0 0 1 2.6 0V15c0 3-2 5-4.4 5S3 18 3 15.5Z"/><path d="M13.2 9.5V7a1.3 1.3 0 0 1 2.6 0V6a1.3 1.3 0 0 1 2.6 0v1.5a1.3 1.3 0 0 1 2.6 0V11c0 3-2 5-4.4 5s-3.4-2-3.4-4.5Z"/><path d="M12 3.5l1.5 1.5M8.5 4.5l1 1.8" opacity=".7"/>';

/* ---------- movement & basic ---------- */
I.boots = '<path d="M8 3h4.6v8.6l5.2 2.4c1.5.7 2.2 1.8 2.2 3.1V19H5v-4.4c0-1.6 1-2.6 1.8-3.6.9-1.2 1.2-2.4 1.2-4Z"/><path d="M5 21.2h15"/><path d="M12.6 7H8.2"/>';
I.step = '<ellipse cx="8.5" cy="14.5" rx="3" ry="4.6"/><circle ' + F + ' cx="6.2" cy="7.6" r="1"/><circle ' + F + ' cx="8.6" cy="6.8" r="1"/><circle ' + F + ' cx="10.9" cy="7.5" r="1"/><path d="M15 12h6M18.5 9.5L21 12l-2.5 2.5"/>';
I.sneak = '<ellipse cx="7" cy="16.5" rx="2.2" ry="3.4"/><ellipse cx="15.5" cy="8.5" rx="2.2" ry="3.4" stroke-dasharray="2 1.6"/><circle ' + F + ' cx="5.6" cy="11.6" r=".8"/><circle ' + F + ' cx="7.6" cy="11.2" r=".8"/><circle ' + F + ' cx="14.1" cy="3.6" r=".8"/><circle ' + F + ' cx="16.1" cy="3.4" r=".8"/>';
I.stand = '<circle cx="9" cy="4.5" r="2"/><path d="M9 7v8M9 15l-3 6M9 15l3 6M5 10.5h8"/><path d="M18.5 20V5.5M15.5 8.5l3-3 3 3"/>';
I.prone = '<circle cx="4.8" cy="14.5" r="2"/><path d="M7.5 15.5H20M11 15.5l2.2-3M15.5 15.5l3 3"/><path d="M2.5 20h19"/>';
I.shield = '<path d="M12 2.8l7.5 2.6v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.4Z"/>';
I.raise = I.shield + '<path d="M8.6 12.6L12 9.2l3.4 3.4"/><path d="M12 9.2v6"/>';
I.block = I.shield + '<path d="M12 7v8M8.5 10.5h7"/>';
I.cover = '<path d="M2.5 21v-8h11v8"/><path d="M2.5 17h11M8 13v4M5.2 17v4M10.8 17v4"/><circle cx="18" cy="6.5" r="2"/><path d="M18 9.5c-1.8.8-2.8 2.6-2.8 5.5M18 9.5l1.8 4.5V21"/>';
I.cover1 = '<path d="M12 2.8l7.5 2.6v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.4Z"/><path ' + F + ' d="M12 2.8L4.5 5.4v5.8c0 4.6 3.1 8.2 7.5 10.2Z" opacity=".55"/>';
I.cover2 = '<path ' + F + ' d="M12 2.8l7.5 2.6v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.4Z" opacity=".75"/><path d="M12 2.8l7.5 2.6v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.4Z"/>';
I.cover3 = I.cover2 + '<path d="M2 8v4c0 4 2 7 5 9M22 8v4c0 4-2 7-5 9"/>';
I.escape = '<rect x="2.5" y="8.5" width="9" height="6" rx="3"/><rect x="12.5" y="9.5" width="9" height="6" rx="3"/><path d="M11 4.5l1.2 2.6M14.5 4.2l-.6 2.8M9.5 19.5l1.8-2.2M14 20l-.6-2.6"/>';
I.reload = '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5v4.6h-4.6"/><path d="M8.5 15.5l6-6M12 9.5h2.5V12"/>';
I.potion = '<path d="M9.4 2.8h5.2"/><path d="M10.4 2.8v5L5.8 16.4A3.1 3.1 0 0 0 8.5 21h7a3.1 3.1 0 0 0 2.7-4.6L13.6 7.8v-5"/><path d="M7.4 14h9.2"/><circle ' + F + ' cx="11" cy="17" r=".9"/><circle ' + F + ' cx="13.6" cy="15.6" r=".7"/>';
I.medkit = '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M8.5 6V4.5h7V6"/><path d="M12 9.5v7M8.5 13h7"/>';
I.end = '<path d="M4.5 5.5l7 6.5-7 6.5"/><path d="M12.5 5.5l7 6.5-7 6.5"/>';
I.hourglass = '<path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9"/><path ' + F + ' d="M9.5 19.5c.7-1.6 1.6-2.4 2.5-2.9.9.5 1.8 1.3 2.5 2.9Z"/>';
I.delay = I.hourglass;
I.ready = '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 2"/><path d="M9.5 2.5h5"/>';
I.stance = '<circle cx="12" cy="4" r="2"/><path d="M12 6.5v6M12 12.5l-5 7.5M12 12.5l5 7.5M5.5 9.5L12 8l6.5 1.5"/><path d="M3.5 21.5h17"/>';
I.rage = '<path d="M12 2l1.9 5.1 5.2-2-2 5.2L22 12l-4.9 1.7 2 5.2-5.2-2L12 22l-1.9-5.1-5.2 2 2-5.2L2 12l4.9-1.7-2-5.2 5.2 2Z"/><path d="M9 10.5l2 1M15 10.5l-2 1M9.8 15c1.4-1 3-1 4.4 0"/>';
I.giant = '<path d="M3.5 21v-4.5a2 2 0 0 1 4 0V21"/><circle cx="5.5" cy="11.6" r="1.4"/><circle cx="16" cy="4.6" r="2.2"/><path d="M16 7.6v6.4M12.5 21l3.5-7 3.5 7M12 10.4h8"/><path d="M9.5 9V3M7.6 4.9L9.5 3l1.9 1.9"/>';
I.breath = '<path d="M3 12l7-2.5V14.5Z"/><path d="M10 9.5L21 4M10 14.5L21 20"/><path d="M13.5 12h4M15 9.5l3-1M15 14.5l3 1" opacity=".75"/>';
I.gem = '<path d="M6 3h12l3.5 5L12 21 2.5 8Z"/><path d="M2.5 8h19M9 3l-1.5 5L12 21l4.5-13L15 3"/>';
I.speech = '<path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-5 4v-4H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5Z"/><path d="M7 9h10M7 12h6"/>';
I.command = '<path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-5 4v-4H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5Z"/><path d="M12 7.5v4"/><circle ' + F + ' cx="12" cy="13.6" r="1"/>';
I.music = '<path d="M9 18V5.5l11-2.2v12.4"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="15.8" r="2.5"/><path d="M9 9.2l11-2.2"/>';
I.wand = '<path d="M3.5 20.5l11-11"/><path d="M13 8l3 3"/><path d="M18 2.5v4M16 4.5h4M20.5 9v3M19 10.5h3M12.5 2.8v2.4M11.3 4h2.4"/>';
I.skull = '<path d="M12 3C7.6 3 4.5 6 4.5 10c0 2.5 1.2 4.2 3 5.2V19h9v-3.8c1.8-1 3-2.7 3-5.2C19.5 6 16.4 3 12 3Z"/><circle ' + F + ' cx="9" cy="10.6" r="1.7"/><circle ' + F + ' cx="15" cy="10.6" r="1.7"/><path d="M12 13.2l-1 2h2Z"/><path d="M10 19v-2.2M12 19v-2.2M14 19v-2.2"/><path d="M7.5 21.5h9"/>';
I.mask = '<path d="M3.8 5.5c3.2-1.6 13.2-1.6 16.4 0 0 7.5-3.2 12.6-8.2 13.8-5-1.2-8.2-6.3-8.2-13.8Z"/><path d="M7.2 9.6l3.2 1.2M16.8 9.6l-3.2 1.2"/><path d="M8.8 14.4c1.8 1.6 4.6 1.6 6.4 0"/>';
I.trip = '<circle cx="16.5" cy="4.5" r="2"/><path d="M15.4 7.2l-4 6.3"/><path d="M11.4 13.5l-4.6 2.8M11.4 13.5l2.6 4.2"/><path d="M14.5 9.8l4.2.8"/><path d="M2.5 21h19"/><path d="M4 18.5c1.5-2 3.5-2.5 5.5-1.5" opacity=".75"/>';
I.shove = '<path d="M2.5 12h12.5"/><path d="M10.5 7l5 5-5 5"/><path d="M19 5v14M22 8v8"/>';
I.hand = '<path d="M8 21v-4.6L5 13.3a1.6 1.6 0 0 1 2.3-2.3l1.7 1.7V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 7.6a1.5 1.5 0 0 1 3 0V11"/><path d="M18 9.6a1.5 1.5 0 0 1 3 0v5.4c0 3.3-2.2 6-5.4 6H8"/>';
I.grapple = I.hand + '<path d="M2.5 4.5l2 2M2 9h2" opacity=".7"/>';
I.hood = '<path d="M12 2.8c-4.4 0-7.2 4.2-7.2 9.2v9h14.4v-9c0-5-2.8-9.2-7.2-9.2Z"/><path ' + F + ' d="M8.6 14c0-2.2 1.4-3.8 3.4-3.8s3.4 1.6 3.4 3.8v3.2H8.6Z" opacity=".8"/>';
I.seek = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/><path d="M7 10.5c1.6-2.2 5.4-2.2 7 0-1.6 2.2-5.4 2.2-7 0Z"/><circle ' + F + ' cx="10.5" cy="10.5" r="1"/>';
I.eye = '<path d="M2.5 12c2.4-4.4 5.8-7 9.5-7s7.1 2.6 9.5 7c-2.4 4.4-5.8 7-9.5 7s-7.1-2.6-9.5-7Z"/><circle cx="12" cy="12" r="3"/>';
I.eyeOff = I.eye + '<path d="M4 4l16 16"/>';
I.sick = '<circle cx="12" cy="12" r="8.8"/><path d="M8 9.4l2.2 1M16 9.4l-2.2 1"/><path d="M8 16.2c1.1-1.4 2.6-1.4 4 0s2.9 1.4 4 0"/><path d="M17.5 13.5v3.2" opacity=".75"/>';

/* ---------- damage / spell types ---------- */
I.fire = '<path d="M12 2.8c1 3.6 5.6 5.6 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-2.6 1.3-4.1 2.8-5.4.2 2 1 3 2.2 3.3-.6-3.2.1-5.9.6-8.5Z"/><path d="M12 20.4a2.4 2.4 0 0 1-2.4-2.4c0-1.6 2.4-3.4 2.4-3.4s2.4 1.8 2.4 3.4a2.4 2.4 0 0 1-2.4 2.4Z"/>';
I.cold = '<path d="M12 2v20M3.4 7l17.2 10M3.4 17l17.2-10"/><path d="M9.6 3.8L12 5.6l2.4-1.8M9.6 20.2L12 18.4l2.4 1.8M3.6 10.2l2.8-.4-.9-2.8M20.4 13.8l-2.8.4.9 2.8M5.5 16.9l.9-2.7-2.8-.4M18.5 7.1l-.9 2.7 2.8.4"/>';
I.electricity = '<path d="M13.5 2L5 13.5h6.2L10 22l9-12.2h-6.2Z"/>';
I.acid = '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11Z"/><circle ' + F + ' cx="10" cy="15" r="1.3"/><circle ' + F + ' cx="13.8" cy="17.6" r=".9"/><circle cx="14" cy="12.6" r=".8"/>';
I.sonic = '<path d="M3 9.5h3l4-3.5v12l-4-3.5H3Z"/><path d="M14 9a4.2 4.2 0 0 1 0 6M17 6.5a7.8 7.8 0 0 1 0 11M20 4a11.5 11.5 0 0 1 0 16"/>';
I.force = star4(12, 12, 10, 1.9) + '<circle cx="12" cy="12" r="5.8" opacity=".6"/>';
I.void = '<circle cx="12" cy="12" r="8.6"/><path ' + F + ' d="M15.2 4.2a8.6 8.6 0 0 0 0 15.6 7 7 0 0 1 0-15.6Z" opacity=".85"/><circle ' + F + ' cx="9" cy="9" r=".8"/><circle ' + F + ' cx="8" cy="14.5" r=".6"/>';
I.sun = '<circle cx="12" cy="12" r="4.2"/>' + rays(12, 12, 6.6, 9.6, 8);
I.spirit = '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.4" stroke-dasharray="2 2"/>' + rays(12, 12, 8.4, 10.6, 8, Math.PI / 8);
I.mental = '<path d="M12.6 12.2a1.4 1.4 0 0 1-1.4 1.6 2.8 2.8 0 0 1-2.8-2.9 4.2 4.2 0 0 1 4.3-4.1 5.6 5.6 0 0 1 5.5 5.7 7 7 0 0 1-7.1 6.9A8.4 8.4 0 0 1 2.7 11"/>';
I.heal = '<path d="M12 20.2C5 15.6 3 12 3 8.8A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 9 2C21 12 19 15.6 12 20.2Z"/><path d="M12 9.6v6M9 12.6h6"/>';
I.harm = '<path d="M12 20.2C5 15.6 3 12 3 8.8A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 9 2C21 12 19 15.6 12 20.2Z"/><path d="M12 8l-1.6 4 3 1.6-2 4"/>';
I.pulse = '<path d="M12 20.2C5 15.6 3 12 3 8.8A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 9 2C21 12 19 15.6 12 20.2Z"/><path d="M5.5 12h3l1.5-2.5 2 5 1.5-2.5h5"/>';
I.poison = '<path d="M9 2.8h6M10 2.8v4.5c-3 1.2-5 3.9-5 6.9a7 7 0 0 0 14 0c0-3-2-5.7-5-6.9V2.8"/><circle ' + F + ' cx="10" cy="14" r="1.2"/><circle ' + F + ' cx="14" cy="14" r="1.2"/><path d="M10.5 17.5h3"/>';
I.bleed = '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11Z"/><path d="M9.3 14.6a2.8 2.8 0 0 0 2.6 2.6"/>';
I.air = '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15.5a3 3 0 1 1-3 3"/><path d="M3 16h7"/>';
I.water = '<path d="M2.5 8.5c3.2-3 6.3 3 9.5 0s6.3 3 9.5 0"/><path d="M2.5 13.5c3.2-3 6.3 3 9.5 0s6.3 3 9.5 0"/><path d="M2.5 18.5c3.2-3 6.3 3 9.5 0s6.3 3 9.5 0"/>';
I.metal = '<path d="M3 15L15 3M7 19L19 7M11 21L21 11"/><path d="M15 3l-2 .5M19 7l-2 .5M21 11l-2 .5"/>';
I.portal = '<ellipse cx="12" cy="12" rx="5.2" ry="9"/><ellipse cx="12" cy="12" rx="2.2" ry="5"/><path d="M2 12h4M18 12h4M20 10l2 2-2 2"/>';
I.d20 = '<path d="M12 2L20.7 7v10L12 22l-8.7-5V7Z"/><path d="M12 2L7 15h10Z"/><path d="M3.3 7L7 15M20.7 7L17 15M7 15l5 7 5-7"/>';
I.buff = '<path d="M7 13l5-5 5 5"/><path d="M7 19l5-5 5 5"/><ellipse cx="12" cy="4.5" rx="6" ry="1.8"/>';
I.debuff = '<path d="M7 5l5 5 5-5"/><path d="M7 11l5 5 5-5"/><path d="M5 20.5h14"/>';
I.halo = '<ellipse cx="12" cy="5" rx="6.5" ry="2.2"/><circle cx="12" cy="13" r="3"/><path d="M6.5 21.5c.8-3.4 2.9-5 5.5-5s4.7 1.6 5.5 5"/>';
I.sleep = '<path d="M19.5 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10 10.5Z"/><path d="M14 3.5h4l-4 4h4"/>';
I.moon = I.sleep;
I.slick = '<path d="M3 18c3-2 6 1 9-1s6 2 9 0"/><path d="M12 3.5c2 3 3.5 4.8 3.5 6.5a3.5 3.5 0 0 1-7 0c0-1.7 1.5-3.5 3.5-6.5Z"/>';
I.blur = '<circle cx="12" cy="9" r="3.4"/><path d="M5.5 21c.8-4 3.4-6.5 6.5-6.5s5.7 2.5 6.5 6.5"/><path d="M3 9c0-2.2.6-3.8 1.6-5M21 9c0-2.2-.6-3.8-1.6-5M2 15c.5 1.4 1.2 2.6 2 3.6M22 15c-.5 1.4-1.2 2.6-2 3.6" opacity=".7"/>';
I.lock = '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle ' + F + ' cx="12" cy="15.6" r="1.4"/>';
I.sparkle = '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8Z"/><path d="M18.5 15v5M16 17.5h5"/>';
I.spellbook = '<path d="M3.5 5c2.6-1 5.8-1 8.5.6 2.7-1.6 5.9-1.6 8.5-.6v14c-2.6-1-5.8-1-8.5.6-2.7-1.6-5.9-1.6-8.5-.6Z"/><path d="M12 5.6v14"/><path d="M6.5 9.5h2.8M14.7 9.5h2.8M6.5 12.5h2.8M14.7 12.5h2.8"/>';
I.burst = '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="2.4 2"/>' + rays(12, 12, 4.6, 6.6, 8);
I.cone = '<path d="M3 12L20 4.5v15Z"/><path d="M20 4.5a16 16 0 0 1 0 15" opacity=".7"/>';
I.line = '<path d="M3 15l16-9"/><path d="M4.4 17.4l16-9"/><circle ' + F + ' cx="3.4" cy="16.2" r="1.4"/>';
I.emanation = '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.5" stroke-dasharray="2 2"/>';
I.haste = '<path d="M3.5 6.5l5.5 5.5-5.5 5.5M10 6.5l5.5 5.5-5.5 5.5"/><path d="M17.5 6.5v11M20.5 6.5v11" opacity=".7"/>';
I.armor = '<path d="M7 3.5l5 2 5-2 3.5 3.5-2 3v10.5H5.5V10l-2-3Z"/><path d="M12 5.5v15"/>';
I.flame2 = I.fire;
I.light = I.sun;

/* ---------- conditions ---------- */
I.frightened = '<circle cx="12" cy="12" r="8.8"/><circle ' + F + ' cx="9" cy="10" r="1.4"/><circle ' + F + ' cx="15" cy="10" r="1.4"/><path d="M7.8 16l1.4-1.3 1.4 1.3 1.4-1.3 1.4 1.3 1.4-1.3 1.4 1.3"/>';
I.sickened = I.sick;
I.clumsy = '<path d="M3 13c2-4 4 4 6 0s4 4 6 0 3 3.5 6 0"/><path d="M18.2 10.4L21 13l-3.4.8"/><path d="M6 6l1.5 1.5M10 4.5v2M14 6l-1.5 1.5" opacity=".7"/>';
I.enfeebled = '<path d="M3.5 9v6M6.5 7v10M17.5 7v10M20.5 9v6M6.5 12h11"/><path d="M14 4l-4 16" opacity=".8"/>';
I.drained = '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11Z"/><path d="M9 14h6"/>';
I.stupefied = I.mental;
I.stunned = '<ellipse cx="12" cy="7.5" rx="8.5" ry="3"/><circle cx="12" cy="16" r="4.5"/>' + star4(4.6, 7, 2.2, .6) + star4(19.4, 7, 2.2, .6) + star4(12, 4.5, 2.2, .6);
I.slowed = I.hourglass;
I.offguard = '<path d="M12 2.8l7.5 2.6v5.8c0 4.6-3.1 8.2-7.5 10.2-4.4-2-7.5-5.6-7.5-10.2V5.4Z"/><path d="M12.6 3.2L10.6 8.5l3 2.8-2.4 4 1 5.6"/>';
I.grabbed = I.hand;
I.restrained = '<rect x="3" y="4" width="8" height="5.5" rx="2.75"/><rect x="8" y="9.2" width="8" height="5.5" rx="2.75"/><rect x="13" y="14.5" width="8" height="5.5" rx="2.75"/>';
I.immobilized = '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7.5 11h9"/><path d="M4.5 14a7.5 7.5 0 0 0 15 0"/>';
I.paralyzed = I.lock;
I.blinded = I.eyeOff;
I.dazzled = '<path d="M2.5 13c2.4-4 5.8-6.4 9.5-6.4s7.1 2.4 9.5 6.4c-2.4 4-5.8 6.4-9.5 6.4S4.9 17 2.5 13Z"/><circle cx="12" cy="13" r="2.6"/><path d="M12 1.5v2.6M4.5 3.8l1.6 2M19.5 3.8l-1.6 2"/>';
I.deafened = '<path d="M7 9.5a5.5 5.5 0 0 1 11 0c0 3.2-3.2 4.2-3.2 7.3a3 3 0 0 1-6 0"/><path d="M10 9.8a2.5 2.5 0 0 1 5 0"/><path d="M3.5 3.5l17 17"/>';
I.fleeing = '<circle cx="15" cy="4" r="2"/><path d="M14.2 7l-3.2 6 4 3v5M11 13l-4 4.5H4M13.5 8.5l4.5 2.5M12.6 8l-4.6 1.2"/><path d="M2 8h4M3 11.5h3" opacity=".7"/>';
I.fatigued = '<rect x="2.5" y="8" width="16" height="9" rx="2"/><path d="M21 11v3"/><path ' + F + ' d="M5 10.5h3v4H5Z"/>';
I.unconscious = '<path d="M4 7h5l-5 6h5"/><path d="M13 4h4l-4 5h4"/><path d="M14 14h6l-6 6.5h6"/>';
I.dying = '<path d="M12 20.2C5 15.6 3 12 3 8.8A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 9 2C21 12 19 15.6 12 20.2Z"/><path d="M12 6.8l-1.5 3.8 3 2-2 4.4"/>';
I.wounded = '<path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11Z"/><path d="M9.2 12.5l5.6 3.4M14.8 12.5l-5.6 3.4"/>';
I.quickened = '<path d="M5 13l7-7 7 7"/><path d="M5 19l7-7 7 7"/>';
I.persist = '<path d="M19.8 12a7.8 7.8 0 1 1-2.3-5.5"/><path d="M19.8 3.6v4.2h-4.2"/><path d="M12 8.2c1.6 2.3 2.8 3.6 2.8 5a2.8 2.8 0 0 1-5.6 0c0-1.4 1.2-2.7 2.8-5Z"/>';
I.hidden = I.hood;
I.concealed = '<path d="M3 9c3-2 6 2 9 0s6 2 9 0M3 14c3-2 6 2 9 0s6 2 9 0M3 19c3-2 6 2 9 0s6 2 9 0" stroke-dasharray="3 2"/>';
I.fxgood = I.sparkle;
I.fxbad = I.debuff;
I.shieldUp = I.raise;

/* ---------- class emblems ---------- */
I.fighter = I.swords2;
I.rogue = I.dagger;
I.ranger = '<path d="M5 3.5Q19 5 20.5 19"/><path d="M5 3.5L20.5 19"/><path d="M4 20c0-6 3.5-9.5 9-10.5-1 5.6-4.4 9.4-9 10.5Z"/><path d="M4 20l6-6"/>';
I.barbarian = '<path d="M4 21.5l10.5-10.5"/><path d="M10.2 7.6L14 3.8C18.6 2.4 22.6 6.4 21.2 11L17.4 14.8Z"/><path d="M10.2 7.6L7.6 6.4l1 3.4M8 12.6l-2.6 1 3.4 1"/>';
I.champion = I.shield + '<path d="M12 6.8v10M8.4 10.6h7.2"/>';
I.monk = '<path d="M12 20c-4 0-8-2-9-6 3-1 6 0 9 3 3-3 6-4 9-3-1 4-5 6-9 6Z"/><path d="M12 17c-2.2-2.5-2.6-6.2 0-10.2 2.6 4 2.2 7.7 0 10.2Z"/><path d="M8.4 15c-1.5-2-2-4.5-1-7 1.5 1 2.5 2.5 3 4M15.6 15c1.5-2 2-4.5 1-7-1.5 1-2.5 2.5-3 4"/>';
I.bard = '<circle cx="9" cy="15" r="5.5"/><circle cx="9" cy="15" r="1.5"/><path d="M12.8 11.2L19.5 4.5"/><path d="M18.2 3l2.8 2.8M17.4 5.4l1.2 1.2"/>';
I.cleric = '<circle cx="12" cy="12" r="3.6"/>' + rays(12, 12, 5.8, 10, 12) + '<circle cx="12" cy="12" r="1.2" class="f"/>';
I.wizard = '<path d="M2.5 20.5h19"/><path d="M5.5 20.5c1.5-5 3.2-11 7.5-16.5-.6 3 0 5 1 6.2 1.6 2.6 2.6 6 3 10.3"/><path d="M8.6 14.6c2.4.8 5 .8 7.4-.2"/>' + star4(18.6, 5, 2.4, .7);
I.sorcerer = '<circle cx="12" cy="14" r="5.5"/><path d="M12 8.5c-1.5-2-1-4 .5-5.8.3 1.7 1.7 2.5 2.4 4"/><path d="M8.4 14.6c1.4-2.6 4.6-3 6.6-.8M10 17c1.3.8 3 .8 4.3-.2"/>';
I.druid = '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15Z"/><path d="M5 19l9-9M9.5 14.5H13M12 12V9"/>';
I.alchemist = I.potion; I.investigator = I.seek; I.oracle = I.eye; I.witch = I.moon; I.magus = I.swords2; I.summoner = I.portal; I.swashbuckler = I.lunge; I.gunslinger = I.aim; I.inventor = gear(12, 12, 5.5, 8.5, 8) + '<circle cx="12" cy="12" r="2.5"/>'; I.thaumaturge = I.d20; I.psychic = I.mental; I.kineticist = I.air;

/* ---------- creature emblems ---------- */
I.humanoid = '<path d="M5 12.5C5 7 8 3.5 12 3.5S19 7 19 12.5v8H5Z"/><path d="M7.5 11.5h9M12 11.5v9"/><circle class="f" cx="8.6" cy="15.5" r=".8"/><circle class="f" cx="8.6" cy="18" r=".8"/><circle class="f" cx="15.4" cy="15.5" r=".8"/><circle class="f" cx="15.4" cy="18" r=".8"/>';
I.goblin = '<path d="M8 10L2 6.5l4.2 7.2M16 10l6-3.5-4.2 7.2"/><path d="M12 7.5c3.5 0 6 2.8 6 6.3s-2.5 6.7-6 6.7-6-3.2-6-6.7 2.5-6.3 6-6.3Z"/><circle ' + F + ' cx="9.8" cy="13" r="1"/><circle ' + F + ' cx="14.2" cy="13" r="1"/><path d="M10 17h4"/>';
I.undead = I.skull;
I.paw = '<ellipse cx="12" cy="16" rx="4.6" ry="4"/><ellipse cx="5.4" cy="11" rx="1.8" ry="2.4"/><ellipse cx="9.2" cy="6.6" rx="1.8" ry="2.4"/><ellipse cx="14.8" cy="6.6" rx="1.8" ry="2.4"/><ellipse cx="18.6" cy="11" rx="1.8" ry="2.4"/>';
I.animal = I.paw; I.beast = I.paw;
I.dragon = '<path d="M3 19C6 11 10.5 6.5 21 4.5c-3 3-3.8 5-3.8 7-2.3 0-4.2 1-5.2 3-2 0-3.6 1-4.6 2.8Z"/><path d="M8 17l3-6M12 14.5l3.5-5.5"/>';
I.fiend = '<path d="M7 2.8c-2.4 3-1.6 6.4 1.8 8.4M17 2.8c2.4 3 1.6 6.4-1.8 8.4"/><path d="M12 9c3.3 0 5.6 2.7 5.6 6s-2.3 6-5.6 6-5.6-2.7-5.6-6 2.3-6 5.6-6Z"/><path d="M9.5 14l2 1M14.5 14l-2 1M10 18h4"/>';
I.elemental = '<path d="M12 2.5l7 9.5-7 9.5-7-9.5Z"/><path d="M12 2.5v19M5 12h14" opacity=".55"/>';
I.construct = gear(12, 12, 6, 9, 8) + '<circle cx="12" cy="12" r="2.6"/>';
I.ooze = '<path d="M3.5 19c0-5 2.5-10 8.5-10s8.5 5 8.5 10Z"/><path d="M8.5 9.6C8 7.4 9.6 5.5 12 5.5s4 1.9 3.5 4.1"/><circle ' + F + ' cx="10" cy="14" r="1"/><circle ' + F + ' cx="14.5" cy="15.5" r=".8"/>';
I.plant = I.druid;
I.fey = '<path d="M12 7v13"/><path d="M12 9C9 3 3 3 3 8c0 3.5 4 5 9 3.5"/><path d="M12 9c3-6 9-6 9-1 0 3.5-4 5-9 3.5"/><path d="M12 13c-3 0-6 2-6 4.5S9 20 12 16.5M12 13c3 0 6 2 6 4.5S15 20 12 16.5"/>';
I.aberration = '<circle cx="12" cy="9" r="5.5"/><circle ' + F + ' cx="12" cy="9" r="1.8"/><path d="M8 13.5c-1 3-3 4-4.5 4.5M12 14.5v6.5M16 13.5c1 3 3 4 4.5 4.5"/>';
I.giantC = '<path d="M6 21l6.5-6.5"/><path d="M10.5 12.5c-1-3.8 2-8.5 6.4-9.4 2.4-.5 4.7 1.8 4.2 4.2-.9 4.4-5.6 7.4-9.4 6.4Z"/><circle ' + F + ' cx="16" cy="7" r=".8"/><circle ' + F + ' cx="18" cy="9.5" r=".7"/>';
I.swarm = '<circle ' + F + ' cx="6" cy="7" r="1.4"/><circle ' + F + ' cx="12" cy="5" r="1.4"/><circle ' + F + ' cx="17.5" cy="8.5" r="1.4"/><circle ' + F + ' cx="8.5" cy="13" r="1.4"/><circle ' + F + ' cx="15" cy="14" r="1.4"/><circle ' + F + ' cx="6" cy="18.5" r="1.4"/><circle ' + F + ' cx="12" cy="19.5" r="1.4"/><circle ' + F + ' cx="18.5" cy="18" r="1.4"/>';
I.caster = I.wizard;
I.bird = '<path d="M2.5 9.5c3 0 5.5 1.5 7.5 4 2-5 5.5-8 11.5-8.5-2 2.5-3 5-3 8 0 4-3.5 7-8 7-3 0-5.5-1.5-6.5-4"/><circle ' + F + ' cx="15.5" cy="9.5" r=".9"/>';
I.rat = '<path d="M3 15.5c0-4 3.5-7 8-7 3.5 0 6 1.5 7.5 4l3 1-3 2c-1 2-3.5 3-7.5 3-5 0-8-1-8-3Z"/><circle cx="12" cy="8" r="2"/><circle ' + F + ' cx="17" cy="13" r=".8"/><path d="M3 15.5C1.5 15 1 13 2 11.5"/>';
I.troll = I.giant;
I.winged = I.bird;

/* ---------- UI chrome ---------- */
I.gear = gear(12, 12, 6.8, 9.6, 8) + '<circle cx="12" cy="12" r="3"/>';
I.help = '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4.1"/><circle ' + F + ' cx="12" cy="17.4" r="1"/>';
I.log = '<path d="M6 3.5h11.5a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 18V5.5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 11.5h8M8 15h5"/>';
I.play = '<path d="M7 4.5v15l12-7.5Z"/>';
I.auto = '<circle cx="12" cy="12" r="9"/><path d="M10 8.2v7.6l6-3.8Z"/>';
I.pause = '<path d="M8 5v14M16 5v14"/>';
I.close = '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>';
I.back = '<path d="M14.5 5l-7 7 7 7"/>';
I.next = '<path d="M9.5 5l7 7-7 7"/>';
I.plus = '<path d="M12 5v14M5 12h14"/>';
I.minus = '<path d="M5 12h14"/>';
I.search = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>';
I.filter = '<path d="M3.5 5h17l-6.5 8v6l-4 1.5V13Z"/>';
I.home = '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>';
I.users = '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.8 3-6 6.2-6s5.6 2.2 6.2 6"/><circle cx="16.8" cy="9" r="2.6"/><path d="M16.5 14c2.6.2 4.3 2 4.8 5"/>';
I.user = '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4.2 3.6-6.6 7.5-6.6s6.7 2.4 7.5 6.6"/>';
I.map = '<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5Z"/><path d="M9 3.5v14.5M15 6v14.5"/>';
I.dice = I.d20;
I.trash = '<path d="M4 6.5h16M9.5 6.5V4h5v2.5"/><path d="M6 6.5l1 14h10l1-14"/><path d="M10 10.5v6.5M14 10.5v6.5"/>';
I.save = '<path d="M5 3.5h11.5L20.5 7.5V20a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M8 3.5v5h7v-5M8 20.5v-6h8v6"/>';
I.copy = '<rect x="8" y="8" width="12.5" height="12.5" rx="2"/><path d="M15.5 8V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H8"/>';
I.info = '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle ' + F + ' cx="12" cy="7.6" r="1"/>';
I.check = '<path d="M4.5 12.5l5 5 10-11"/>';
I.warn = '<path d="M12 3.5l9.5 16.5h-19Z"/><path d="M12 10v4.5"/><circle ' + F + ' cx="12" cy="17.2" r="1"/>';
I.speed = '<path d="M3.5 17a8.5 8.5 0 1 1 17 0"/><path d="M12 17l4.5-6"/><circle ' + F + ' cx="12" cy="17" r="1.4"/><path d="M6.5 11l1.2 1M17.5 11l-1.2 1M12 8.5V10"/>';
I.camera = '<path d="M3.5 8a1.5 1.5 0 0 1 1.5-1.5h3l1.6-2.5h4.8l1.6 2.5h3A1.5 1.5 0 0 1 20.5 8v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"/><circle cx="12" cy="13" r="3.6"/>';
I.grid = '<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>';
I.react = '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5v4.6h-4.6"/><path d="M12 8.5v4l2.5 1.5"/>';
I.hero = star4(12, 12, 10, 3) ;
I.focus = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle ' + F + ' cx="12" cy="12" r="1.6"/>';
I.crown = '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z"/><path d="M5 19h14"/>';
I.target = I.aim;
I.flag = '<path d="M5 21V3.5"/><path d="M5 4h12l-2.5 4L17 12H5"/>';
I.dot = '<circle ' + F + ' cx="12" cy="12" r="4"/>';

/* ---------- API ---------- */
const Icons = PF.Icons = { set: I };
Icons.has = n => !!I[n];
// returns an inline SVG string; size in px; extra class names
Icons.svg = (name, size, cls, title) => {
  const body = I[name] || I.sparkle;
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) + '" aria-hidden="' + (title ? 'false' : 'true') + '"' + (title ? ' role="img"' : '') + ' focusable="false">' + (title ? '<title>' + String(title).replace(/[<&]/g, '') + '</title>' : '') + body + '</svg>';
};

const DMG_ICON = { fire: 'fire', cold: 'cold', electricity: 'electricity', acid: 'acid', sonic: 'sonic', force: 'force', void: 'void', vitality: 'sun', spirit: 'spirit', mental: 'mental', poison: 'poison', bleed: 'bleed', air: 'air', water: 'water', metal: 'metal', light: 'sun', shadow: 'void', heal: 'heal', bludgeoning: 'hammer', piercing: 'spear', slashing: 'sword' };
Icons.forDamage = type => DMG_ICON[type] || 'sparkle';
Icons.DMG_COLOR = { fire: '#ff8a3d', cold: '#8fd8ff', electricity: '#cfe3ff', acid: '#9be34a', sonic: '#d7b8ff', force: '#b49cff', void: '#a37bd8', vitality: '#ffe7a0', spirit: '#fff1b8', mental: '#ff8ad8', poison: '#8fd36a', bleed: '#ff6a6a', heal: '#8ff0a4', bludgeoning: '#d9d4c6', piercing: '#d9d4c6', slashing: '#d9d4c6' };

// spell icon: by distinctive id first, then traits, then shape
const SPELL_ID = { heal: 'heal', harm: 'harm', layOnHands: 'heal', soothe: 'heal', stabilize: 'pulse', shield: 'shield', mysticArmor: 'armor', bless: 'halo', angelicHalo: 'halo', heroism: 'buff', haste: 'haste', slow: 'hourglass', sureStrike: 'd20', grease: 'slick', sleep: 'sleep', fear: 'frightened', command: 'command', blur: 'blur', paralyze: 'lock', blindness: 'eyeOff', enfeeble: 'enfeebled', dimensionDoor: 'portal', qiRush: 'haste', dragonClaws: 'claw', gougingClaw: 'claw', laughingFit: 'mask', dizzyingColors: 'dazzled', phantomPain: 'mental', daze: 'stunned', disintegrate: 'force', courageousAnthem: 'music', dirgeOfDoom: 'music', rallyingAnthem: 'music', telekineticProjectile: 'thrown', vampiricFeast: 'void', innerUpheaval: 'fist', hydraulicPush: 'water', gustOfWind: 'air', needleDarts: 'metal' };
const SPELL_TRAIT = ['composition', 'fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'void', 'vitality', 'spirit', 'water', 'air', 'metal', 'poison', 'shadow', 'light', 'teleportation', 'healing', 'fear', 'illusion', 'mental', 'fortune'];
const TRAIT_ICON = { composition: 'music', vitality: 'sun', healing: 'heal', shadow: 'void', light: 'sun', teleportation: 'portal', fear: 'frightened', illusion: 'mask', fortune: 'd20' };
Icons.forSpell = sp => {
  if (!sp) return 'sparkle';
  if (SPELL_ID[sp.id]) return SPELL_ID[sp.id];
  const tr = sp.traits || [];
  for (const t of SPELL_TRAIT) if (tr.includes(t)) return TRAIT_ICON[t] || DMG_ICON[t] || t;
  if (sp.area) return sp.area.t === 'cone' ? 'cone' : sp.area.t === 'line' ? 'line' : 'burst';
  if (sp.tgt === 'ally') return 'buff';
  if (sp.tgt === 'enemy' && sp.save) return 'debuff';
  return 'sparkle';
};
Icons.spellColor = sp => {
  if (!sp) return null;
  const tr = sp.traits || [];
  if (sp.id === 'heal' || tr.includes('healing')) return '#8ff0a4';
  for (const t of ['fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'void', 'vitality', 'spirit', 'mental']) if (tr.includes(t)) return Icons.DMG_COLOR[t];
  if (tr.includes('composition')) return '#e7b8ff';
  return null;
};

// strike icon: from weapon group, traits, name
Icons.forStrike = s => {
  if (!s) return 'sword';
  const n = (s.name || '').toLowerCase(); const tr = s.traits || [];
  if (s.kind === 'ranged') {
    if (tr.some(t => t.startsWith('thrown')) || /javelin|dart|spear|rock|boulder|toss|throw|spine|bomb|fire$/.test(n) && !/bow/.test(n)) return /bomb|fire|flask|alchemist/.test(n) ? 'fire' : 'thrown';
    if (/crossbow/.test(n) || s.reload) return 'crossbow';
    if (/bolt|ray|blast|spit|breath/.test(n)) return 'electricity';
    return 'bow';
  }
  if (/jaws|bite|fang|maw|beak/.test(n)) return 'jaws';
  if (/claw|talon|tiger/.test(n)) return 'claw';
  if (/horn|gore|antler|tusk/.test(n)) return 'horn';
  if (/tail|tentacle|whip/.test(n)) return 'tail';
  if (tr.includes('unarmed') || s.group === 'brawling' || /fist|slam|punch|kick|unarmed|wing/.test(n)) return 'fist';
  if (s.group === 'axe' || /axe|necksplitter|chopper/.test(n)) return 'axe';
  if (['hammer', 'club', 'flail'].includes(s.group) || /hammer|mace|club|maul|morningstar|flail|staff/.test(n)) return 'hammer';
  if (['polearm', 'spear'].includes(s.group) || /spear|glaive|halberd|pike|trident|horsechopper|lance/.test(n)) return 'spear';
  if (/dagger|knife|dogslicer|sickle/.test(n)) return 'dagger';
  return 'sword';
};

const ACT_ICON = {
  stride: 'boots', move: 'boots', step: 'step', raiseShield: 'raise', takeCover: 'cover', stand: 'stand', escape: 'escape', reload: 'reload',
  demoralize: 'skull', feint: 'mask', trip: 'trip', shove: 'shove', grapple: 'grapple', hide: 'hood', sneak: 'sneak', seek: 'seek', potion: 'potion', medicine: 'medkit', retch: 'sick',
  huntPrey: 'prey', rage: 'rage', suddenCharge: 'charge', monsterCharge: 'charge', doubleSlice: 'swords2', exactingStrike: 'precise', snaggingStrike: 'hook', viciousSwing: 'axe',
  pointBlankStance: 'stance', intimidatingStrike: 'skull', lunge: 'lunge', knockdown: 'trip', swipe: 'swipe', monsterSwipe: 'swipe', doubleShot: 'arrows2', tripleShot: 'arrows3', certainStrike: 'precise',
  twinFeint: 'mask', mobility: 'boots', skirmishStrike: 'step', huntedShot: 'arrows2', twinTakedown: 'swords2', huntersAim: 'aim', runningReload: 'reload', furiousFinish: 'rage', knockback: 'shove',
  giantsStature: 'giant', dragonBreath: 'breath', stance: 'stance', flurry: 'flurry', flyingKick: 'kick', tigerSlash: 'claw', drainBonded: 'gem', lingering: 'music', fortissimo: 'music', bonMot: 'speech',
  reachSpell: 'wand', widenSpell: 'wand', breath: 'breath', screech: 'sonic', frenzy: 'claw', end: 'end', delay: 'hourglass', ready: 'ready', spells: 'spellbook', shieldBlock: 'block'
};
Icons.forAction = a => {
  if (!a) return 'sparkle';
  if (a.id === 'strike') return Icons.forStrike(a.sref);
  if (a.id === 'cast') return Icons.forSpell(a.cast && a.cast.spell);
  if (a.id === 'monsterCharge' && a.name && /charge/i.test(a.name)) return 'charge';
  return ACT_ICON[a.id] || 'sparkle';
};

const COND_ICON = { frightened: 'frightened', sickened: 'sickened', clumsy: 'clumsy', enfeebled: 'enfeebled', drained: 'drained', stupefied: 'stupefied', stunned: 'stunned', slowed: 'slowed', offguard: 'offguard', prone: 'prone', grabbed: 'grabbed', restrained: 'restrained', immobilized: 'immobilized', paralyzed: 'paralyzed', blinded: 'blinded', dazzled: 'dazzled', deafened: 'deafened', fleeing: 'fleeing', fatigued: 'fatigued', unconscious: 'unconscious', dying: 'dying', wounded: 'wounded', quickened: 'quickened', persist: 'persist', hidden: 'hidden', prey: 'prey' };
// c = {k, n, bad} from B.condList
Icons.forCond = c => {
  if (!c) return 'dot';
  if (COND_ICON[c.k]) return c.k === 'persist' ? (DMG_ICON[(c.n.split(' ').pop() || '')] || 'persist') : COND_ICON[c.k];
  const n = (c.n || '').toLowerCase();
  if (/rage/.test(n)) return 'rage';
  if (/stance/.test(n)) return 'stance';
  if (/shield/.test(n)) return 'shield';
  if (/cover/.test(n)) return 'cover';
  if (/bless|heroism|anthem|courage|inspire/.test(n)) return 'buff';
  if (/haste|quick/.test(n)) return 'haste';
  if (/armor/.test(n)) return 'armor';
  if (/blur|conceal|mist/.test(n)) return 'blur';
  if (/feint|off-guard/.test(n)) return 'offguard';
  if (/grease/.test(n)) return 'slick';
  if (/sure strike|fortune/.test(n)) return 'd20';
  if (/hunt|prey/.test(n)) return 'prey';
  if (/dirge|fear/.test(n)) return 'frightened';
  if (/bon mot/.test(n)) return 'speech';
  return c.bad ? 'debuff' : 'sparkle';
};

Icons.CLASS_COLOR = { fighter: '#c9d3dc', rogue: '#b59ce0', ranger: '#a6c97a', barbarian: '#e39a68', champion: '#f0d27a', monk: '#f0aa5a', bard: '#de90e6', cleric: '#f5e0a0', wizard: '#86b8f0', sorcerer: '#f07f78', druid: '#86d49a' };
// emblem for a PC (cls) or creature-like record (traits/shape)
Icons.emblemFor = (o) => {
  if (!o) return { icon: 'user', color: '#9fb4ba' };
  if (o.cls && I[o.cls]) return { icon: o.cls, color: Icons.CLASS_COLOR[o.cls] || '#c9d3dc' };
  const tr = o.traits || []; const sh = o.shape || '';
  const has = t => tr.includes(t);
  let icon = 'humanoid';
  if (has('undead') || sh === 'skeleton' || sh === 'zombie') icon = 'undead';
  else if (has('dragon') || sh === 'dragon') icon = 'dragon';
  else if (has('goblin') || has('kobold') || sh === 'small') icon = 'goblin';
  else if (has('fiend') || has('demon') || has('devil')) icon = 'fiend';
  else if (has('giant') || sh === 'giant') icon = 'giantC';
  else if (has('elemental')) icon = 'elemental';
  else if (has('construct')) icon = 'construct';
  else if (has('ooze')) icon = 'ooze';
  else if (has('plant') || has('fungus')) icon = 'plant';
  else if (has('fey')) icon = 'fey';
  else if (has('aberration')) icon = 'aberration';
  else if (has('swarm')) icon = 'swarm';
  else if (sh === 'rat') icon = 'rat';
  else if (sh === 'winged' || has('beast') && sh === 'winged') icon = 'bird';
  else if (has('animal') || has('beast') || sh === 'beast' || sh === 'owlbear') icon = 'paw';
  else if (sh === 'caster') icon = 'wizard';
  return { icon, color: o.color || '#d9876f' };
};

})(typeof window !== 'undefined' ? window : globalThis);
