import { GraphSharePointProvider } from "./sharepoint/GraphSharePointProvider";
import { createSqlJsDbProvider } from "./SqlJsDbProvider";
import type { DbProvider, SqlExecute, SqlQueryAll } from "./DbProvider";
import { isMsalConfigured } from "../services/msal";

function useSharePointProvider(): boolean {
  const flag = import.meta.env.VITE_FEATURE_SP_TRAINING;
  return flag === "true" || flag === "1";
}

function getSharePointOptions() {
  return {
    siteId: import.meta.env.VITE_SHAREPOINT_SITE_ID,
    skillsListId: import.meta.env.VITE_SHAREPOINT_SKILLS_LIST_ID,
    personSkillsListId: import.meta.env.VITE_SHAREPOINT_PERSON_SKILLS_LIST_ID,
    personQualitiesListId: import.meta.env.VITE_SHAREPOINT_PERSON_QUALITIES_LIST_ID,
  };
}

export function createDbProvider(all: SqlQueryAll, run: SqlExecute): DbProvider {
  if (useSharePointProvider() && isMsalConfigured()) {
    return new GraphSharePointProvider(getSharePointOptions());
  }
  return createSqlJsDbProvider(all, run);
}
