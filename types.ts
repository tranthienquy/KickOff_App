export enum EventStatus {
  WAITING = 'waiting',
  ACTIVATED = 'activated'
}

export interface AppState {
  status: EventStatus;
  waitingUrl: string;
  activatedUrl: string;
  splashVideoUrl: string;
  buttonText: string;
  timestamp: number;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix: string;
  readyText: string;
  scrollingText: string;
}

export const INITIAL_STATE: AppState = {
  status: EventStatus.WAITING,
  // Video mẫu tạm thời
  waitingUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 
  activatedUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  splashVideoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  
  buttonText: 'INITIALIZE SYNC-STREAM',
  timestamp: Date.now(),
  titlePrefix: 'AI',
  titleHighlight: 'YOUNG',
  titleSuffix: 'GURU',
  readyText: 'READY',
  scrollingText: 'WELCOME TO THE AI YOUNG GURU LAUNCH EVENT • PLEASE TAKE YOUR SEATS • EVENT STARTING SOON'
};
