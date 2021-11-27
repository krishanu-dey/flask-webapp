import { navigate } from "@reach/router";
import { Action, action, Thunk, thunk } from "easy-peasy";
import {
  StudyCode,
  ParticipantCode,
  SessionToken,
  EventDescriptor,
  SessionCreationCredentials,
  requestSession,
  sendSessionHeartbeat,
  signOutSession,
  submitEvent,
  studyEnabled,
} from "../database/study-server";
import { delaySeconds, withinApp } from "../utils";

type ScalarSessionState = {
  status:
    | "not-in-use"
    | "booting"
    | "validating-saved-session"
    | "no-valid-session"
    | "failed"
    | "signing-out"
    | "signed-out";
};

export type ParticipationInfo = {
  participantCode: ParticipantCode;
  sessionToken: SessionToken;
};

export type JoiningSessionState = {
  status: "joining";
  phase:
    | { status: "awaiting-user-input" }
    | { status: "requesting-session" }
    | ({ status: "awaiting-user-ok" } & ParticipationInfo);
  studyCode: StudyCode;
  nFailedAttempts: number;
};

type ValidSessionState = { status: "valid" } & ParticipationInfo;

export type SessionState =
  | ScalarSessionState
  | JoiningSessionState
  | ValidSessionState;

// Need to export this for use within unit tests:
export const SAVED_SESSION_TOKEN_KEY = "studyParticipantSessionToken";

export type SetSessionPayload = ParticipationInfo & {
  next: "go-to-homepage" | "keep-existing";
};

type ScalarStateStatus = ScalarSessionState["status"];

export type ISessionState = SessionState & {
  setNoSession: Action<ISessionState>;
  setValidatingSavedSession: Action<ISessionState>;
  setFailed: Action<ISessionState>;
  setSigningOut: Action<ISessionState>;
  setSignedOut: Action<ISessionState>;
  tryJoinStudy: Action<ISessionState, StudyCode>;
  retryJoinStudy: Action<ISessionState>;
  setSession: Action<ISessionState, SetSessionPayload>;
  announceSession: Action<ISessionState, ParticipationInfo>;
  setRequestingSession: Action<ISessionState>;

  boot: Thunk<ISessionState, SessionToken | null>;
  validateStoredSession: Thunk<ISessionState, ParticipationInfo>;
  requestSession: Thunk<ISessionState, SessionCreationCredentials>;
  signOutSession: Thunk<ISessionState>;
  submitEvent: Thunk<ISessionState, EventDescriptor>;
};

const setScalarStatus = (status: ScalarStateStatus): Action<ISessionState> =>
  action((_state) => ({ status }));

export const sessionState: ISessionState = {
  status: studyEnabled ? "booting" : "not-in-use",

  setNoSession: setScalarStatus("no-valid-session"),
  setValidatingSavedSession: setScalarStatus("validating-saved-session"),
  setFailed: setScalarStatus("failed"),
  setSigningOut: setScalarStatus("signing-out"),
  setSignedOut: setScalarStatus("signed-out"),

  tryJoinStudy: action(
    (_state, studyCode) =>
      ({
        status: "joining",
        phase: { status: "awaiting-user-input" },
        studyCode,
        nFailedAttempts: 0,
      } as const)
  ),

  retryJoinStudy: action((state) => {
    (state as JoiningSessionState).phase = { status: "awaiting-user-input" };
    (state as JoiningSessionState).nFailedAttempts += 1;
  }),

  setSession: action((_state, info) => {
    const participationInfo: ParticipationInfo = {
      participantCode: info.participantCode,
      sessionToken: info.sessionToken,
    };

    window.localStorage.setItem(
      SAVED_SESSION_TOKEN_KEY,
      JSON.stringify(participationInfo)
    );

    if (info.next === "go-to-homepage") {
      navigate(withinApp("/"), { replace: true });
    }

    return { status: "valid", ...participationInfo };
  }),

  announceSession: action((state, participationInfo) => {
    (state as JoiningSessionState).phase = {
      status: "awaiting-user-ok",
      ...participationInfo,
    };
  }),

  setRequestingSession: action((state) => {
    (state as JoiningSessionState).phase = { status: "requesting-session" };
  }),

  boot: thunk(async (actions, maybeStudyCode) => {
    if (maybeStudyCode != null) {
      actions.tryJoinStudy(maybeStudyCode);
    } else {
      const maybeInfoStr = window.localStorage.getItem(SAVED_SESSION_TOKEN_KEY);
      if (maybeInfoStr != null) {
        // TODO: Validation in case somebody meddles with stored value?
        console.log(`recovering saved info from "${maybeInfoStr}"`);
        const info = JSON.parse(maybeInfoStr) as ParticipationInfo;
        await actions.validateStoredSession(info);
      } else {
        actions.setNoSession();
      }
    }
  }),

  validateStoredSession: thunk(async (actions, participationInfo) => {
    actions.setValidatingSavedSession();

    const response = await sendSessionHeartbeat(participationInfo.sessionToken);
    if (response.status === "ok") {
      actions.setSession({ ...participationInfo, next: "keep-existing" });
    } else {
      actions.setNoSession();
    }
  }),

  requestSession: thunk(async (actions, credentials) => {
    actions.setRequestingSession();

    await delaySeconds(0.8);
    const response = await requestSession(credentials);

    switch (response.status) {
      case "ok":
        actions.announceSession({
          participantCode: credentials.participantCode,
          sessionToken: response.token,
        });
        break;
      case "rejected":
        actions.retryJoinStudy();
        break;
      case "error":
        actions.setFailed();
        break;
    }
  }),

  signOutSession: thunk(async (actions, _voidPayload, helpers) => {
    const state = helpers.getState() as ValidSessionState;
    const sessionToken = state.sessionToken;

    actions.setSigningOut();

    window.localStorage.removeItem(SAVED_SESSION_TOKEN_KEY);
    await delaySeconds(0.8);
    await signOutSession(sessionToken);

    actions.setSignedOut();

    navigate(withinApp("/"), { replace: true });
  }),

  submitEvent: thunk(async (_actions, eventDescriptor, helpers) => {
    if (!studyEnabled) {
      // It is a NOP, not an error, to call this thunk when
      // instrumentation is not enabled in the app build.
      return;
    }

    const state = helpers.getState();
    if (state.status !== "valid") {
      console.warn(
        `cannot submit "${eventDescriptor.kind}" event; no valid session`
      );
      return;
    }

    await submitEvent(state.sessionToken, eventDescriptor);
  }),
};
