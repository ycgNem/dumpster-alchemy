// The mixer: an SFX bus and a music bus (with tape wobble and a dull top end) into a master gain,
// a gentle glue compressor, a fast limiter, an output trim, a soft safety clipper (nothing gets
// past ~0.88) and the mute gain. Built the same way on a live or an offline context.
import { biquad, gainNode } from './synth';

export interface Chain {
  /** Every sound effect goes in here (one voice gain + panner per sound). */
  sfx: GainNode;
  /** Every music track goes in here. */
  music: GainNode;
  master: GainNode;
  mute: GainNode;
}

/** Bus levels; the per-sound trims are in sfx.ts. */
export const MIX = {
  sfx: 0.9,
  music: 0.3,
  out: 0.8,
};

/** Linear to ~0.6, then a smooth shoulder that never passes ~0.88. */
function safetyCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  const knee = 0.6;
  const room = 0.33;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + room * Math.tanh((ax - knee) / room);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export function buildChain(ctx: BaseAudioContext): Chain {
  const sfx = gainNode(ctx, MIX.sfx);
  const music = gainNode(ctx, 1);

  // Tape: a delay line whose length wobbles slowly (wow) and quickly (flutter) bends the pitch
  // of everything on the music bus by a few cents, for one node.
  const tape = ctx.createDelay(0.05);
  tape.delayTime.value = 0.012;
  const wow = ctx.createOscillator();
  wow.frequency.value = 0.55;
  const flutter = ctx.createOscillator();
  flutter.frequency.value = 6.3;
  wow.connect(gainNode(ctx, 0.0018)).connect(tape.delayTime);
  flutter.connect(gainNode(ctx, 0.00009)).connect(tape.delayTime);
  wow.start();
  flutter.start();
  const musicOut = gainNode(ctx, MIX.music);
  music
    .connect(tape)
    .connect(biquad(ctx, 'lowpass', 8500, 0.5))
    .connect(biquad(ctx, 'highpass', 38, 0.7))
    .connect(musicOut);

  const master = gainNode(ctx, 1);
  sfx.connect(master);
  musicOut.connect(master);

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 10;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.006;
  glue.release.value = 0.25;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 1;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;

  const clip = ctx.createWaveShaper();
  clip.curve = safetyCurve();
  const mute = gainNode(ctx, 1);

  master.connect(glue).connect(limiter).connect(gainNode(ctx, MIX.out)).connect(clip).connect(mute).connect(ctx.destination);
  return { sfx, music, master, mute };
}
