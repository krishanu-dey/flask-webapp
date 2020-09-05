import React from "react";
import { useStoreState, useStoreActions } from "../store";
import { SyncState } from "../model/project";
import RawElement from "./RawElement";

interface TutorialNavigationProps {
  kind: "prev" | "next";
  toChapterIndex: number;
}

const TutorialNavigation = ({
  kind,
  toChapterIndex,
}: TutorialNavigationProps) => {
  const chapters = useStoreState(
    (state) => state.activeTutorial.tutorial?.chapters
  );

  if (chapters == null) {
    throw Error("no chapters to create navigation element");
  }

  const navigateToChapter = useStoreActions(
    (actions) => actions.activeTutorial.navigateToChapter
  );

  const navigateToTargetChapter = () => navigateToChapter(toChapterIndex);

  const toChapterTitle = chapters[toChapterIndex].title;

  // TODO: Turn 'kind' into something more human-friendly.
  return (
    <span onClick={navigateToTargetChapter}>
      {kind}: {toChapterTitle}
    </span>
  );
};

const TutorialChapter = () => {
  const syncState = useStoreState((state) => state.activeTutorial.syncState);
  const activeTutorial = useStoreState(
    (state) => state.activeTutorial.tutorial
  );

  switch (syncState) {
    case SyncState.NoProject:
      // TODO: Would be nice to be able to give link straight to
      // particular tutorial, in which case the following might happen?
      // Or maybe that link would just show a short 'creating...'
      // message and then bounce onwards to "/ide/new-project-id".
      //
      // Think this should never happen.
      return <div>(No tutorial)</div>;
    case SyncState.Error:
      return <div>Error loading tutorial.</div>;
    case SyncState.SyncingToStorage:
      // Should never happen (unless we move tutorial creation into
      // the browser...).
      return (
        <div>Error: should not be trying to sync tutorial TO storage.</div>
      );
    case SyncState.SyncingFromStorage:
      return <div>Loading...</div>;
    case SyncState.Syncd:
      // Fall through to handle this case.
      break;
  }

  if (activeTutorial == null)
    throw Error("state is Syncd but no active tutorial");

  const chapterIndex = activeTutorial.activeChapterIndex;
  const activeChapter = activeTutorial.chapters[chapterIndex];

  return (
    <div className="TutorialChapter">
      <h1>{activeChapter.title}</h1>
      {activeChapter.contentNodes.map((node, idx) => (
        <RawElement key={idx} element={node} />
      ))}
      {activeChapter.maybePrevTitle && (
        <TutorialNavigation kind="prev" toChapterIndex={chapterIndex - 1} />
      )}
      {activeChapter.maybeNextTitle && (
        <TutorialNavigation kind="next" toChapterIndex={chapterIndex + 1} />
      )}
    </div>
  );
};