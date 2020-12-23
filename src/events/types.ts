import { RoughCanvas } from "roughjs/bin/canvas";
import { ActionManager } from "../actions/manager";
import { SceneHistory } from "../history";
import Scene from "../scene/Scene";
import { AppState } from "../types";

export type EventProcessIO = {
  done: boolean;
  state: Partial<AppState>;
  event: Event;
  staticState: any;
  state$: AppState;
  staticState$: any;
  scene: Scene;
  rc: RoughCanvas;
  actionManager: ActionManager;
  history: SceneHistory;
};

export type EventProcessor = (input: EventProcessIO) => EventProcessIO;
