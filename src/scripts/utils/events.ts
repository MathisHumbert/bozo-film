type Listener<T> = [T] extends [void] ? () => void : (data: T) => void;

export type ResizeData = {
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  fontSize: number;
};

export type FrameData = {
  time: number;
  deltaTime: number;
};

export type UpdateData = {
  time: number;
  deltaTime: number;
  scroll: number;
  velocity: number;
  direction: number;
};

export type View = "wide" | "list";

export type Bounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type Frame = {
  slug: string;
  bounds: Bounds;
  split: number;
  order: number;
};

export type Hero = {
  from: Frame;
  to: Frame;
  progress: number;
  seal: number;
};

export type HomeLeave = {
  view: View;
  from: Frame | null;
  titles: HTMLElement[];
};

type AppEvents = {
  loaded: void;
  "page:loaded": void;
  "transition:start": { from: string; to: string };
  "transition:end": void;
  resize: ResizeData;
  "start-update": FrameData;
  update: UpdateData;
  "end-update": FrameData;
  lenis: unknown;
  touchdown: MouseEvent | TouchEvent;
  touchmove: MouseEvent | TouchEvent;
  touchup: MouseEvent | TouchEvent;
  click: MouseEvent;
  wheel: WheelEvent;
  "modal:open": { name: string };
  "modal:close": { name: string };
  "modal:opened": { name: string };
  "modal:closed": { name: string };
  "device:motion": { reducedMotion: boolean };
  "home:view": { view: View };
  "home:leave": HomeLeave;
  "home:shown": { view: View };
};

class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private _listeners = {} as {
    [K in keyof TEvents]?: Set<Listener<TEvents[K]>>;
  };

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    if (!this._listeners[event]) {
      this._listeners[event] = new Set();
    }
    this._listeners[event]!.add(listener);
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    this._listeners[event]?.delete(listener);
  }

  emit<K extends keyof TEvents>(
    event: K,
    ...args: [TEvents[K]] extends [void] ? [] : [data: TEvents[K]]
  ) {
    this._listeners[event]?.forEach((l) =>
      (l as (...a: unknown[]) => void)(...args),
    );
  }
}

export const events = new TypedEventEmitter<AppEvents>();
