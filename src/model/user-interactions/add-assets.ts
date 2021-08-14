import { action, Action, thunk, Thunk } from "easy-peasy";
import { readArraybuffer } from "../../utils";
import { IPytchAppModel } from "..";

export type Failure = {
  fileName: string;
  reason: string;
};

type ScalarState =
  | { status: "idle" }
  | { status: "awaiting-user-choice" }
  | { status: "trying-to-add" };

type ScalarStatus = ScalarState["status"];

type State =
  | ScalarState
  | { status: "showing-failures"; failures: Array<Failure> };

export type IAddAssetsInteraction = State & {
  setScalar: Action<IAddAssetsInteraction, ScalarStatus>;
  setFailed: Action<IAddAssetsInteraction, Array<Failure>>;
  launch: Thunk<IAddAssetsInteraction>;
  tryAdd: Thunk<IAddAssetsInteraction, FileList, any, IPytchAppModel>;
  dismiss: Thunk<IAddAssetsInteraction>;
};

// Convert (eg) ProgressUpdate error for unreadable file into something
// a bit more human-friendly:
const simpleReadArraybuffer = async (file: File) => {
  try {
    return await readArraybuffer(file);
  } catch (e) {
    throw new Error("problem reading file");
  }
};

export const addAssetsInteraction: IAddAssetsInteraction = {
  status: "idle",

  setScalar: action((_state, status) => ({ status })),

  setFailed: action((_state, failures) => ({
    status: "showing-failures",
    failures,
  })),

  launch: thunk((actions) => actions.setScalar("awaiting-user-choice")),

  dismiss: thunk((actions) => actions.setScalar("idle")),
};
