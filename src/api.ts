export interface BulkCreateItem {
  id?: string;
  name: string;
  description: string;
  price: number;
  isRegionalPricingEnabled: boolean;
  imageFile: File | null;
  error?: string;
  // added to mark if it's an existing item (for update)
  isExisting?: boolean; 
  iconUrl?: string;
  isDirty?: boolean;
}

export type BulkAssetType = 'DevProduct' | 'GamePass' | 'Decal';

export async function fetchUniverseInfo(universeId: string, apiKey?: string) {
  let name = "Unknown Game";
  let iconUrl = "";

  // 1. Try public games API first
  try {
    const res = await fetch(`/api/games/v1/games?universeIds=${universeId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.data?.[0]?.name) {
        name = data.data[0].name;
      }
    }
  } catch (err) {
    console.error("Public games API fetch failed", err);
  }

  // 2. If it's still "Unknown Game" and we have an API key, try the Open Cloud v2 universes API
  if (name === "Unknown Game" && apiKey) {
    try {
      const ocRes = await fetch(`/api/roblox/cloud/v2/universes/${universeId}`, {
        headers: { "x-api-key": apiKey }
      });
      if (ocRes.ok) {
        const ocData = await ocRes.json();
        name = ocData.displayName ?? ocData.name ?? name;
      }
    } catch (err) {
      console.error("Open Cloud universe fetch failed", err);
    }
  }

  // 3. Fetch thumbnail (works for private games too)
  try {
    const iconRes = await fetch(`/api/thumbnails/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png`);
    if (iconRes.ok) {
      const iconData = await iconRes.json();
      iconUrl = iconData.data?.[0]?.imageUrl ?? "";
    }
  } catch (err) {
    console.error("Thumbnail fetch failed", err);
  }

  return { name, iconUrl };
}

// ---- Game Passes ----
export async function listGamePasses(apiKey: string, universeId: string): Promise<BulkCreateItem[]> {
  let allPasses: any[] = [];
  let pageToken = "";
  let hasNext = true;

  while (hasNext) {
    const url = `/api/roblox/game-passes/v1/universes/${universeId}/game-passes/creator?pageSize=100` + 
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey }
    });
    if (!res.ok) break;
    const body = await res.json();
    const pageItems = body.gamePasses || [];
    allPasses = [...allPasses, ...pageItems];
    pageToken = body.nextPageToken || "";
    hasNext = !!pageToken && pageItems.length > 0;
  }

  const passes = allPasses.map((gp: any) => ({
    id: String(gp.gamePassId),
    name: gp.name || "",
    description: gp.description || "",
    price: gp.priceInformation?.defaultPriceInRobux ?? 0,
    isRegionalPricingEnabled: gp.priceInformation?.enabledFeatures?.includes("RegionalPricing") ?? false,
    isExisting: true,
    imageFile: null,
    iconUrl: ""
  }));

  if (passes.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < passes.length; i += chunkSize) {
      const chunk = passes.slice(i, i + chunkSize);
      const ids = chunk.map((p: any) => p.id).join(",");
      try {
        const iconRes = await fetch(`/api/thumbnails/v1/game-passes?gamePassIds=${ids}&size=150x150&format=Png`);
        if (iconRes.ok) {
          const iconData = await iconRes.json();
          for (const pd of chunk) {
             const match = iconData.data?.find((d: any) => String(d.targetId) === pd.id);
             if (match && match.imageUrl) pd.iconUrl = match.imageUrl;
          }
        }
      } catch {}
    }
  }
  return passes;
}

export async function createGamePass(apiKey: string, universeId: string, item: BulkCreateItem) {
  const form = new FormData();
  if (item.name) form.append("name", item.name);
  if (item.description !== undefined) form.append("description", item.description);
  form.append("price", item.price.toString());
  form.append("isForSale", "true");
  form.append("isRegionalPricingEnabled", item.isRegionalPricingEnabled ? "true" : "false");
  
  if (item.imageFile) {
    form.append("imageFile", item.imageFile);
  }

  const res = await fetch(`/api/roblox/game-passes/v1/universes/${universeId}/game-passes`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function updateGamePass(apiKey: string, universeId: string, gamePassId: string, item: BulkCreateItem) {
  const form = new FormData();
  if (item.name) form.append("name", item.name);
  if (item.description !== undefined) form.append("description", item.description);
  form.append("price", item.price.toString());
  form.append("isForSale", "true");
  form.append("isRegionalPricingEnabled", item.isRegionalPricingEnabled ? "true" : "false");
  
  if (item.imageFile) {
    form.append("imageFile", item.imageFile);
  }

  const res = await fetch(`/api/roblox/game-passes/v1/universes/${universeId}/game-passes/${gamePassId}`, {
    method: "PATCH",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ---- Dev Products ----
export async function listDeveloperProducts(apiKey: string, universeId: string): Promise<BulkCreateItem[]> {
  let allProducts: any[] = [];
  let pageToken = "";
  let hasNext = true;

  while (hasNext) {
    const url = `/api/roblox/developer-products/v2/universes/${universeId}/developer-products/creator?pageSize=100` + 
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey }
    });
    if (!res.ok) break;
    const body = await res.json();
    const pageItems = body.developerProducts || [];
    allProducts = [...allProducts, ...pageItems];
    pageToken = body.nextPageToken || "";
    hasNext = !!pageToken && pageItems.length > 0;
  }
  
  const products = allProducts.map((dp: any) => ({
    id: String(dp.productId),
    name: dp.name || "",
    description: dp.description || "",
    price: dp.priceInformation?.defaultPriceInRobux ?? 0,
    isRegionalPricingEnabled: dp.priceInformation?.enabledFeatures?.includes("RegionalPricing") ?? false,
    isExisting: true,
    imageFile: null,
    iconUrl: "",
    _assetId: dp.iconImageAssetId
  }));

  const validAssets = products.filter((p: any) => p._assetId);
  if (validAssets.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < validAssets.length; i += chunkSize) {
      const chunk = validAssets.slice(i, i + chunkSize);
      const assetIds = chunk.map((p: any) => p._assetId).join(",");
      try {
        const iconRes = await fetch(`/api/thumbnails/v1/assets?assetIds=${assetIds}&size=150x150&format=Png`);
        if (iconRes.ok) {
          const iconData = await iconRes.json();
          for (const pd of chunk) {
             const match = iconData.data?.find((d: any) => String(d.targetId) === String(pd._assetId));
             if (match && match.imageUrl) pd.iconUrl = match.imageUrl;
          }
        }
      } catch {}
    }
  }
  return products;
}

export async function createDeveloperProduct(apiKey: string, universeId: string, item: BulkCreateItem) {
  const form = new FormData();
  if (item.name) form.append("name", item.name);
  if (item.description !== undefined) form.append("description", item.description);
  form.append("priceInRobux", item.price.toString());
  form.append("price", item.price.toString());
  form.append("isForSale", "true");
  form.append("isRegionalPricingEnabled", item.isRegionalPricingEnabled ? "true" : "false");
  
  if (item.imageFile) {
    form.append("imageFile", item.imageFile);
  }

  const res = await fetch(`/api/roblox/developer-products/v2/universes/${universeId}/developer-products`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function updateDeveloperProduct(apiKey: string, universeId: string, productId: string, item: BulkCreateItem) {
  const form = new FormData();
  if (item.name) form.append("name", item.name);
  if (item.description !== undefined) form.append("description", item.description);
  form.append("priceInRobux", item.price.toString());
  form.append("price", item.price.toString());
  form.append("isForSale", "true");
  form.append("isRegionalPricingEnabled", item.isRegionalPricingEnabled ? "true" : "false");
  
  if (item.imageFile) {
    form.append("imageFile", item.imageFile);
  }

  const res = await fetch(`/api/roblox/developer-products/v2/universes/${universeId}/developer-products/${productId}`, {
    method: "PATCH",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ---- Decals / Images ----
function getImageContentType(file: File) {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".bmp")) return "image/bmp";
  if (lowerName.endsWith(".tga")) return "image/tga";
  return "image/png";
}

export async function getAssetOperation(apiKey: string, operationPath: string) {
  const operationId = operationPath.replace(/^operations\//, "");
  const res = await fetch(`/api/roblox/assets/v1/operations/${operationId}`, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  return res.json();
}

async function waitForAssetOperation(apiKey: string, operationPath: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const operation = await getAssetOperation(apiKey, operationPath);
    if (!operation.done) continue;
    if (operation.error || operation.status) {
      const message = operation.error?.message || operation.status?.message || "Roblox rejected the asset update";
      throw new Error(message);
    }
    return operation.response || operation;
  }

  return { path: operationPath };
}

export async function getAsset(apiKey: string, assetId: string) {
  const res = await fetch(`/api/roblox/assets/v1/assets/${assetId}`, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  return res.json();
}

export async function updateDecalMetadata(apiKey: string, assetId: string, item: BulkCreateItem) {
  const form = new FormData();
  form.append("request", JSON.stringify({
    assetType: "Decal",
    assetId,
    displayName: item.name,
    description: item.description || "",
  }));

  const res = await fetch(`/api/roblox/assets/v1/assets/${assetId}?updateMask=description%2CdisplayName`, {
    method: "PATCH",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const body = await res.json();
  if (!body.path) return body;
  return waitForAssetOperation(apiKey, body.path);
}

export async function createGroupDecal(apiKey: string, groupId: string, item: BulkCreateItem) {
  if (!item.imageFile) {
    throw new Error("A decal image file is required");
  }

  const form = new FormData();
  form.append("request", JSON.stringify({
    assetType: "Decal",
    displayName: item.name,
    description: item.description || "",
    creationContext: {
      creator: {
        groupId,
      },
    },
  }));
  const uploadFile = item.imageFile.type
    ? item.imageFile
    : new File([item.imageFile], item.imageFile.name, { type: getImageContentType(item.imageFile) });
  form.append("fileContent", uploadFile, uploadFile.name);

  const res = await fetch(`/api/roblox/assets/v1/assets`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) throw new Error(`Error: ${res.status} - ${await res.text()}`);
  const body = await res.json();
  if (!body.path) return body;

  return waitForAssetOperation(apiKey, body.path);
}
