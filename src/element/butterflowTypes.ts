import { _ExcalidrawElementBase } from "./types";

export type FlowElementTemplate = {
  type: string;
  label: string;
  category?: string[];
  docs?: any;
  config?: any;
};

type _ButterflowElementBase = _ExcalidrawElementBase & {
  label: string;
  next: string[];
  prev: string[];
  tags: string[];
};

export type FlowElement =
  | FunctionFlowElement
  | DebugFlowElement
  | InjectFlowElement;

export type FunctionFlowElement = _ButterflowElementBase & {
  type: "function";
  code: string;
};

export type DebugFlowElement = _ButterflowElementBase & {
  type: "debug";
};

export type InjectFlowElement = _ButterflowElementBase & {
  type: "inject";
  message: string;
};
