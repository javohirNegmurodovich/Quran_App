// server/qfUserCollections.js
// Collection helpers only. Do not put public route handlers here.

import { qfRawUserApi } from "./qfOAuth.js";

export const LEARNED_COLLECTION_NAME = "Nabzi Sakinah — Learned Surahs";

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.collections)) {
    return payload.data.collections;
  }
  if (Array.isArray(payload?.collections)) return payload.collections;
  if (Array.isArray(payload?.nodes)) return payload.nodes;

  return [];
}

function getItemArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.bookmarks)) return payload.data.bookmarks;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.bookmarks)) return payload.bookmarks;
  if (Array.isArray(payload?.nodes)) return payload.nodes;

  return [];
}

export function extractSurahNumbersFromItems(items) {
  return [
    ...new Set(
      items
        .map((item) => {
          const candidate =
            item.key ??
            item.surahNumber ??
            item.chapterNumber ??
            item.bookmark?.key ??
            item.bookmark?.surahNumber ??
            item.bookmark?.chapterNumber;

          const number = Number(candidate);
          return Number.isFinite(number) ? number : null;
        })
        .filter(Boolean),
    ),
  ].sort((a, b) => a - b);
}

export async function getAllCollections(req, res) {
  const result = await qfRawUserApi(req, res, "/auth/v1/collections?first=20");

  if (result.status >= 400) return result;

  return {
    ...result,
    json: {
      ...result.json,
      normalizedCollections: unwrapArray(result.json),
    },
  };
}

export async function findCollectionByName(
  req,
  res,
  name = LEARNED_COLLECTION_NAME,
) {
  const collectionsResult = await getAllCollections(req, res);

  if (collectionsResult.status >= 400) return null;

  const collections = collectionsResult.json.normalizedCollections || [];

  return (
    collections.find(
      (collection) =>
        String(collection.name || "")
          .trim()
          .toLowerCase() === String(name).trim().toLowerCase(),
    ) || null
  );
}

export async function findOrCreateLearnedCollection(req, res) {
  const existing = await findCollectionByName(req, res);

  if (existing?.id) return existing;

  const result = await qfRawUserApi(req, res, "/auth/v1/collections", {
    method: "POST",
    body: {
      name: LEARNED_COLLECTION_NAME,
    },
  });

  if (result.status >= 400) {
    const error = new Error(
      result.json?.message || "Failed to create learned collection.",
    );
    error.status = result.status;
    error.payload = result.json;
    throw error;
  }

  return result.json?.data || result.json;
}

export async function getLearnedCollectionItems(req, res, collectionId) {
  const result = await qfRawUserApi(
    req,
    res,
    `/auth/v1/collections/${encodeURIComponent(
      collectionId,
    )}?type=surah&sortBy=recentlyAdded&first=20`,
  );

  if (result.status >= 400) return result;

  return {
    ...result,
    json: {
      ...result.json,
      normalizedItems: getItemArray(result.json),
    },
  };
}
