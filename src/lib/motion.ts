/** Shared timing: quick feedback, gentle entrances, and no looping UI motion. */
export const pockitSpring = { type: 'spring' as const, stiffness: 440, damping: 38, mass: 0.8 }

/** Figma's feedback lift. Event-driven in the app; never repeat the prototype timeline. */
export const pockitFeedbackLift = {
  y: {
    duration: 2,
    times: [0, 0.16, 1],
    ease: ['easeOut', 'linear'] as ('easeOut' | 'linear')[],
    repeat: 0,
  },
}
