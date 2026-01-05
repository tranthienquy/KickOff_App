
export enum EventStatus {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown', // Sẽ được hiển thị là "CLIP CHỜ"
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
  countdownUrl: 'https://www.youtube.com/watch?v=mE9N68Vn_hM', 
  activatedUrl: 'https://www.youtube.com/watch?v=3S1NIn6-L_w',
  timestamp: Date.now()
};
