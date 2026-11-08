// Fixed-step update (60 Hz) with a render every animation frame.

export function startLoop(update: (dt: number) => void, render: () => void, hz = 60): void {
  const step = 1 / hz;
  let acc = 0;
  let last = performance.now();
  const frame = (now: number): void => {
    acc += Math.min(0.25, (now - last) / 1000); // don't spiral after a stall or a hidden tab
    last = now;
    while (acc >= step) {
      update(step);
      acc -= step;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
