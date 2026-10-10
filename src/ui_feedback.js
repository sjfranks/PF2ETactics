/* Small, optional feedback cues. No downloads; audio starts only after a gesture. */
(function (G) {
'use strict';
const App = G.PF.App;
let ctx = null;
const unlock = () => {
  if (!App.settings.sound) return;
  try {
    const Audio = G.AudioContext || G.webkitAudioContext;
    if (!Audio) return;
    if (!ctx) ctx = new Audio();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (_) { /* audio is optional */ }
};
document.addEventListener('pointerdown', unlock, { passive: true });
document.addEventListener('keydown', unlock);
G.addEventListener('tat:settings', unlock);
const cues = {
  select: [[440, 0, .045]], move: [[220, 0, .07], [330, .065, .09]],
  hit: [[150, 0, .1], [75, .025, .13]], miss: [[220, 0, .06], [145, .07, .08]],
  crit: [[330, 0, .12], [494, .06, .13], [660, .13, .18]],
  cast: [[330, 0, .12], [440, .09, .15], [660, .18, .18]],
  heal: [[392, 0, .14], [523, .12, .2]], turn: [[440, 0, .1], [587, .1, .16]],
  win: [[392, 0, .18], [494, .14, .18], [587, .28, .18], [784, .42, .32]],
  loss: [[294, 0, .2], [247, .18, .2], [196, .36, .3]]
};
App.feedback = kind => {
  if (App.settings.haptics && G.navigator.vibrate) {
    try { G.navigator.vibrate(kind === 'crit' ? [18, 35, 28] : kind === 'hit' ? 18 : 8); } catch (_) { /* unsupported */ }
  }
  if (!App.settings.sound || !ctx || ctx.state !== 'running' || document.hidden) return;
  try {
    (cues[kind] || cues.select).forEach(([hz, delay, duration]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay;
      osc.type = kind === 'hit' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.065, start + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start + duration + .02);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  } catch (_) { /* feedback must never interrupt a turn */ }
};
})(window);
