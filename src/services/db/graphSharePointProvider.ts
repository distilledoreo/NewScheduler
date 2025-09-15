import type { DbProvider, MutationOptions, QueryResult } from "./types";
import { acquireGraphToken } from "../security/msal";

const SITE_ID = import.meta.env.VITE_SP_SITE_ID as string;
const LISTS = {
  People: import.meta.env.VITE_SP_LIST_PEOPLE as string,
  Groups: import.meta.env.VITE_SP_LIST_GROUPS as string,
  Roles: import.meta.env.VITE_SP_LIST_ROLES as string,
  Skills: import.meta.env.VITE_SP_LIST_SKILLS as string,
  PersonSkill: import.meta.env.VITE_SP_LIST_PERSON_SKILL as string,
  PersonQuality: import.meta.env.VITE_SP_LIST_PERSON_QUALITY as string,
};

async function g(path: string, init?: RequestInit): Promise<Response> {
  const token = await acquireGraphToken();
  return fetch(`https://graph.microsoft.com/v1.0${path}`,{
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

async function getListItems(listId: string, select?: string, filter?: string): Promise<{ items:any[], etag?:string }>{
  const qs = [select?`$select=${encodeURIComponent(select)}`: "", filter?`$filter=${encodeURIComponent(filter)}`: ""].filter(Boolean).join("&");
  const r = await g(`/sites/${SITE_ID}/lists/${listId}/items?expand=fields&${qs}`);
  const j = await r.json();
  return { items: j.value?.map((it:any)=>({ id: it.id, etag: it["@odata.etag"], ...it.fields })) ?? [], etag: r.headers.get("ETag") ?? undefined };
}

export const graphSharePointProvider: DbProvider = {
  async getPeople() { const { items } = await getListItems(LISTS.People); return { rows: items }; },
  async getSkills() { const { items } = await getListItems(LISTS.Skills); return { rows: items }; },
  async getPersonSkills() {
    const { items } = await getListItems(LISTS.PersonSkill);
    return { rows: items.map((x:any)=>({ personId: x.personId, skillId: x.skillId, rating: x.rating })) };
  },
  async getPersonQualities() { const { items } = await getListItems(LISTS.PersonQuality); return { rows: items }; },

  async upsertPersonSkill(personId, skillId, rating) {
    const { items } = await getListItems(LISTS.PersonSkill, undefined, `personId eq ${personId} and skillId eq ${skillId}`);
    if (!items.length) {
      if (rating == null) return;
      const r = await g(`/sites/${SITE_ID}/lists/${LISTS.PersonSkill}/items`, { method: "POST", body: JSON.stringify({ fields: { personId, skillId, rating } }) });
      if (!r.ok) throw new Error(await r.text());
    } else {
      const item = items[0];
      if (rating == null) {
        const r = await g(`/sites/${SITE_ID}/lists/${LISTS.PersonSkill}/items/${item.id}`, { method: "DELETE", headers: { "If-Match": item.etag } });
        if (!r.ok) throw new Error(await r.text());
      } else {
        const r = await g(`/sites/${SITE_ID}/lists/${LISTS.PersonSkill}/items/${item.id}/fields`, { method: "PATCH", headers: { "If-Match": item.etag }, body: JSON.stringify({ rating }) });
        if (!r.ok) throw new Error(await r.text());
      }
    }
  },
  async upsertPersonQuality(personId, key, rating) {
    const { items } = await getListItems(LISTS.PersonQuality, undefined, `personId eq ${personId}`);
    if (!items.length) {
      const fields:any = { personId, [key]: rating };
      if (rating == null) fields[key] = null;
      const r = await g(`/sites/${SITE_ID}/lists/${LISTS.PersonQuality}/items`, { method: "POST", body: JSON.stringify({ fields }) });
      if (!r.ok) throw new Error(await r.text());
    } else {
      const item = items[0];
      const fields:any = rating == null ? { [key]: null } : { [key]: rating };
      const r = await g(`/sites/${SITE_ID}/lists/${LISTS.PersonQuality}/items/${item.id}/fields`, { method: "PATCH", headers: { "If-Match": item.etag }, body: JSON.stringify(fields) });
      if (!r.ok) throw new Error(await r.text());
    }
  },
  async createSkill(payload) {
    const r = await g(`/sites/${SITE_ID}/lists/${LISTS.Skills}/items`, { method: "POST", body: JSON.stringify({ fields: { code: payload.code, name: payload.name, groupId: payload.groupId, active: true } }) });
    if (!r.ok) throw new Error(await r.text());
  },
  async updateSkill(id, patch) {
    const fields:any = {};
    if (patch.code != null) fields.code = patch.code;
    if (patch.name != null) fields.name = patch.name;
    if (patch.groupId != null) fields.groupId = patch.groupId;
    if (patch.active != null) fields.active = !!patch.active;
    const r = await g(`/sites/${SITE_ID}/lists/${LISTS.Skills}/items/${id}/fields`, { method: "PATCH", body: JSON.stringify(fields) });
    if (!r.ok) throw new Error(await r.text());
  },
  async deleteSkill(id) {
    const r = await g(`/sites/${SITE_ID}/lists/${LISTS.Skills}/items/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
  },
};
