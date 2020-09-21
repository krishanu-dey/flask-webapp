import { Action, action, Thunk, thunk } from "easy-peasy";

import {
  allProjectSummaries,
  createNewProject,
  deleteProject,
  updateTutorialChapter,
} from "../database/indexed-db";

import { TutorialId, ITutorialContent } from "./tutorial";

export type ProjectId = number;

export interface ITrackedTutorialRef {
  slug: TutorialId;
  activeChapterIndex: number;
}

export interface ITrackedTutorial {
  content: ITutorialContent;
  activeChapterIndex: number;
}

export interface ITutorialTrackingUpdate {
  projectId: ProjectId;
  chapterIndex: number;
}

export interface IProjectSummary {
  id: ProjectId;
  name: string;
  summary?: string;
  trackedTutorial?: ITrackedTutorial;
}

export enum LoadingState {
  Idle,
  Pending,
  Succeeded,
  Failed,
}

export interface IProjectCollection {
  loadingState: LoadingState;
  available: Array<IProjectSummary>;

  loadingPending: Action<IProjectCollection>;
  loadingSucceeded: Action<IProjectCollection>;
  setAvailable: Action<IProjectCollection, Array<IProjectSummary>>;
  loadSummaries: Thunk<IProjectCollection>;
  addProject: Action<IProjectCollection, IProjectSummary>;
  createNewProject: Thunk<IProjectCollection, string>;
  requestDeleteProjectThenResync: Thunk<IProjectCollection, ProjectId>;
  deleteProject: Action<IProjectCollection, ProjectId>;
  requestTutorialChapterUpdate: Thunk<
    IProjectCollection,
    ITutorialTrackingUpdate
  >;
  updateTutorialChapter: Action<IProjectCollection, ITutorialTrackingUpdate>;
}

export const projectCollection: IProjectCollection = {
  loadingState: LoadingState.Idle,
  available: [],

  loadingPending: action((state) => {
    state.loadingState = LoadingState.Pending;
  }),
  loadingSucceeded: action((state) => {
    state.loadingState = LoadingState.Succeeded;
  }),

  setAvailable: action((state, summaries) => {
    state.available = summaries;
  }),

  loadSummaries: thunk(async (actions) => {
    actions.loadingPending();
    const summaries = await allProjectSummaries();
    summaries.forEach((s) => actions.addProject(s));
    actions.loadingSucceeded();
  }),

  addProject: action((state, projectSummary) => {
    // TODO: Assert that new project's ID is not already known to us?
    console.log(
      "IProjectCollection.addProject(): adding",
      projectSummary.name,
      projectSummary.summary
    );
    state.available.push(projectSummary);
  }),

  createNewProject: thunk(async (actions, name) => {
    const project = await createNewProject(name);
    actions.addProject(project);
  }),

  requestDeleteProjectThenResync: thunk(async (actions, projectId) => {
    await deleteProject(projectId);
    const summaries = await allProjectSummaries();
    actions.setAvailable(summaries);
  }),

  deleteProject: action((state, projectId) => {
    state.available = state.available.filter((p) => p.id !== projectId);
  }),

  requestTutorialChapterUpdate: thunk(async (actions, trackingUpdate) => {
    await updateTutorialChapter(trackingUpdate);
    actions.updateTutorialChapter(trackingUpdate);
  }),

  updateTutorialChapter: action((state, trackingUpdate) => {
    const targetProjectId = trackingUpdate.projectId;
    const project = state.available.find((p) => p.id === targetProjectId);
    if (project == null) {
      throw Error(`could not find project ${targetProjectId} to update`);
    }
    if (project.trackedTutorial == null) {
      throw Error(`project ${targetProjectId} is not tracking a tutorial`);
    }

    project.trackedTutorial.activeChapterIndex = trackingUpdate.chapterIndex;
  }),
};
