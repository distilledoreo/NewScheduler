import type {
  DbProvider,
  PersonQualitiesRecord,
  PersonSkillRating,
  TrainingSkill,
} from "../DbProvider";
import { acquireMsalToken, ensureMsalLogin, isMsalConfigured } from "../../services/msal";

export interface SharePointProviderOptions {
  siteId?: string;
  skillsListId?: string;
  personSkillsListId?: string;
  personQualitiesListId?: string;
  scopes?: string[];
}

interface SharePointListItem {
  fields?: Record<string, unknown>;
}

interface SharePointListResponse {
  value: SharePointListItem[];
}

const DEFAULT_SCOPES = ["https://graph.microsoft.com/.default"];

export class GraphSharePointProvider implements DbProvider {
  public readonly kind = "graph-sharepoint" as const;

  private readonly options: Required<SharePointProviderOptions>;
  private loginPromise: Promise<void> | null = null;

  constructor(options: SharePointProviderOptions) {
    this.options = {
      siteId: options.siteId ?? "",
      skillsListId: options.skillsListId ?? "",
      personSkillsListId: options.personSkillsListId ?? "",
      personQualitiesListId: options.personQualitiesListId ?? "",
      scopes: options.scopes && options.scopes.length ? options.scopes : DEFAULT_SCOPES,
    };
  }

  private isConfigured(): boolean {
    return Boolean(
      this.options.siteId &&
      this.options.skillsListId &&
      this.options.personSkillsListId &&
      this.options.personQualitiesListId &&
      isMsalConfigured(),
    );
  }

  private async ensureLogin(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("SharePoint provider is not fully configured.");
    }
    if (!this.loginPromise) {
      this.loginPromise = ensureMsalLogin(this.options.scopes).catch((error) => {
        this.loginPromise = null;
        throw error;
      });
    }
    await this.loginPromise;
  }

  private async graphFetch<T = SharePointListResponse>(path: string): Promise<T> {
    await this.ensureLogin();
    const token = await acquireMsalToken(this.options.scopes);
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Graph request failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async getTrainingSkills(): Promise<TrainingSkill[]> {
    if (!this.isConfigured()) {
      console.warn("GraphSharePointProvider: configuration missing; returning empty skills list.");
      return [];
    }

    try {
      const data = await this.graphFetch<SharePointListResponse>(
        `/sites/${this.options.siteId}/lists/${this.options.skillsListId}/items?expand=fields`,
      );
      return data.value.map((item) => {
        const fields = item.fields ?? {};
        const skill: TrainingSkill = {
          id: Number(fields["Id"] ?? fields["id"] ?? 0),
          code: String(fields["Code"] ?? fields["code"] ?? ""),
          name: String(fields["Title"] ?? fields["Name"] ?? fields["title"] ?? ""),
          active: fields["Active"] === false ? 0 : 1,
          groupId: fields["GroupId"] != null ? Number(fields["GroupId"]) : null,
        };
        return skill;
      });
    } catch (error) {
      console.error("GraphSharePointProvider.getTrainingSkills", error);
      return [];
    }
  }

  async getPersonSkillRatings(): Promise<PersonSkillRating[]> {
    if (!this.isConfigured()) {
      console.warn("GraphSharePointProvider: configuration missing; returning empty skill ratings.");
      return [];
    }

    try {
      const data = await this.graphFetch<SharePointListResponse>(
        `/sites/${this.options.siteId}/lists/${this.options.personSkillsListId}/items?expand=fields`,
      );
      return data.value.map((item) => {
        const fields = item.fields ?? {};
        const rating: PersonSkillRating = {
          personId: Number(fields["PersonId"] ?? fields["personId"] ?? 0),
          skillId: Number(fields["SkillId"] ?? fields["skillId"] ?? 0),
          rating: Number(fields["Rating"] ?? fields["rating"] ?? 0),
        };
        return rating;
      });
    } catch (error) {
      console.error("GraphSharePointProvider.getPersonSkillRatings", error);
      return [];
    }
  }

  async setPersonSkillRating(): Promise<void> {
    console.warn("GraphSharePointProvider.setPersonSkillRating is not implemented yet.");
  }

  async getPersonQualities(): Promise<PersonQualitiesRecord[]> {
    if (!this.isConfigured()) {
      console.warn("GraphSharePointProvider: configuration missing; returning empty qualities.");
      return [];
    }

    try {
      const data = await this.graphFetch<SharePointListResponse>(
        `/sites/${this.options.siteId}/lists/${this.options.personQualitiesListId}/items?expand=fields`,
      );
      return data.value.map((item) => {
        const fields = item.fields ?? {};
        const personId = Number(fields["PersonId"] ?? fields["personId"] ?? 0);
        const values: Record<string, number> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value == null) continue;
          if (/PersonId/i.test(key)) continue;
          const numeric = Number(value);
          if (!Number.isNaN(numeric)) {
            values[key] = numeric;
          }
        }
        const record: PersonQualitiesRecord = { personId, values };
        return record;
      });
    } catch (error) {
      console.error("GraphSharePointProvider.getPersonQualities", error);
      return [];
    }
  }

  async setPersonQuality(): Promise<void> {
    console.warn("GraphSharePointProvider.setPersonQuality is not implemented yet.");
  }
}
