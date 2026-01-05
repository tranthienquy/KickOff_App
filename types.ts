
export enum EventStatus {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',
  TRIGGER_READY = 'trigger_ready',
  ACTIVATED = 'activated'
}

export interface AppState {
  status: EventStatus;
  countdownUrl: string;
  activatedUrl: string;
  timestamp: number;
}

export const INITIAL_STATE: AppState = {
  status: EventStatus.WAITING,
  countdownUrl: 'https://assets.mixkit.co/videos/preview/mixkit-mechanical-digital-countdown-timer-2342-large.mp4',
  activatedUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-glowing-particles-background-vj-loop-4663-large.mp4',
  timestamp: Date.now()
};
