// The frame loop. The next frame is asked for before this one runs, so a frame that throws (for
// whatever reason) is reported by the browser as an error and the game carries on with the next,
// rather than stopping dead with nothing to say why. (Found playing the brief's Part J day through:
// docs/PLAYTHROUGH.md.)
//
// raf: requestAnimationFrame (or a stand-in); run(now): one frame's work.
export function frameLoop(raf, run) {
  const frame = (now) => {
    raf(frame);
    run(now);
  };
  return frame;
}
