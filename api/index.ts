import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";

const app: Express = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_FOLDERS = ["Avito", "Avito2", "ПЕРЕКИД_V1.0"];

function getToken(): string {
  const token = process.env.YANDEX_TOKEN;
  if (!token) throw new Error("YANDEX_TOKEN environment variable is not set");
  return token;
}

async function getUploadUrl(path: string, token: string): Promise<string> {
  const encoded = encodeURIComponent(path);
  const res = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encoded}&overwrite=true`,
    { headers: { Authorization: `OAuth ${token}` } }
  );
  if (!res.ok) {
    const data = await res.json() as { description?: string; error?: string };
    if (res.status === 403) throw new Error("Токен Яндекс.Диска не имеет прав на запись файлов");
    if (res.status === 401) throw new Error("Токен Яндекс.Диска недействителен или истёк");
    throw new Error(`Яндекс.Диск: ${data.description || data.error || `HTTP ${res.status}`}`);
  }
  const data = await res.json() as { href: string };
  return data.href;
}

async function uploadToYandex(uploadUrl: string, buffer: Buffer, mimeType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

async function publishFile(path: string, token: string): Promise<string | null> {
  const encoded = encodeURIComponent(path);
  await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encoded}`,
    { method: "PUT", headers: { Authorization: `OAuth ${token}` } }
  );
  const infoRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources?path=${encoded}&fields=public_url`,
    { headers: { Authorization: `OAuth ${token}` } }
  );
  if (!infoRes.ok) return null;
  const data = await infoRes.json() as { public_url?: string };
  return data.public_url || null;
}

async function createFolderIfNeeded(path: string, token: string): Promise<void> {
  const encoded = encodeURIComponent(path);
  await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources?path=${encoded}`,
    { method: "PUT", headers: { Authorization: `OAuth ${token}` } }
  );
}

// In-memory catalog cache (10 min TTL — survives warm Vercel invocations)
let catalogCache: { folders: { article: string; photoCount: number; coverProxyUrl: string }[]; ts: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchAllFolders(token: string): Promise<string[]> {
  type RawFolder = { type: string; name: string };
  const fetchPage = async (baseFolder: string, offset: number) => {
    const res = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(baseFolder)}&limit=1000&offset=${offset}&sort=name`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    if (!res.ok) return { items: [] as RawFolder[], total: 0 };
    const data = await res.json() as { _embedded?: { items?: RawFolder[]; total?: number } };
    return { items: (data._embedded?.items || []).filter(i => i.type === "dir"), total: data._embedded?.total ?? 0 };
  };

  const allNames: string[] = [];
  await Promise.all(BASE_FOLDERS.map(async (baseFolder) => {
    const first = await fetchPage(baseFolder, 0);
    first.items.forEach(i => allNames.push(i.name));
    if (first.total > 1000) {
      const offsets: number[] = [];
      for (let o = 1000; o < first.total; o += 1000) offsets.push(o);
      const BATCH = 5;
      for (let b = 0; b < offsets.length; b += BATCH) {
        const pages = await Promise.all(offsets.slice(b, b + BATCH).map(o => fetchPage(baseFolder, o)));
        pages.forEach(p => p.items.forEach(i => allNames.push(i.name)));
      }
    }
  }));

  return [...new Set(allNames)].sort((a, b) => a.localeCompare(b, "ru"));
}

// ── Routes ─────────────────────────────────────────────────────────────────

app.post("/api/warehouse/photo", upload.single("photo"), async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const article = (req.body?.article || "").toString().trim();
    const file = req.file;
    const folderParam = (req.body?.folder || "").toString().trim();
    const baseFolder = BASE_FOLDERS.includes(folderParam) ? folderParam : BASE_FOLDERS[0];

    if (!article) { res.status(400).json({ error: "Article number is required" }); return; }
    if (!file)    { res.status(400).json({ error: "Photo file is required" }); return; }

    const ext = file.originalname.split(".").pop() || "jpg";
    const filePath = `${baseFolder}/${article}/photo_${Date.now()}.${ext}`;

    await createFolderIfNeeded(`${baseFolder}/${article}`, token);
    const uploadUrl = await getUploadUrl(filePath, token);
    await uploadToYandex(uploadUrl, file.buffer, file.mimetype);
    const publicUrl = await publishFile(filePath, token);

    res.json({ success: true, filename: filePath.split("/").pop()!, publicUrl: publicUrl || "", folder: baseFolder });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

app.get("/api/warehouse/catalog", async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const forceRefresh = req.query.refresh === "1";

    if (catalogCache && !forceRefresh && Date.now() - catalogCache.ts < CACHE_TTL_MS) {
      res.json({ folders: catalogCache.folders, cached: true });
      return;
    }

    const names = await fetchAllFolders(token);
    const folders = names.map(n => ({ article: n, photoCount: 0, coverProxyUrl: "" }));
    catalogCache = { folders, ts: Date.now() };
    res.json({ folders, cached: false });
  } catch (err) {
    console.error("Catalog error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get catalog" });
  }
});

app.get("/api/warehouse/photos/:article", async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const { article } = req.params;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    type RawFile = { type: string; name: string; public_url?: string; path: string };

    const allFiles: RawFile[] = [];
    await Promise.all(BASE_FOLDERS.map(async (baseFolder) => {
      const folderRes = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(`${baseFolder}/${article}`)}&limit=100&preview_size=M&preview_crop=false`,
        { headers: { Authorization: `OAuth ${token}` } }
      );
      if (!folderRes.ok) return;
      const data = await folderRes.json() as { _embedded?: { items?: RawFile[] } };
      allFiles.push(...(data._embedded?.items || []).filter(i => i.type === "file"));
    }));

    const photos = await Promise.all(allFiles.map(async file => {
      const publicUrl = file.public_url || await publishFile(file.path, token) || "";
      return {
        name: file.name,
        publicUrl,
        previewProxyUrl: `${baseUrl}/api/warehouse/photo-proxy?path=${encodeURIComponent(file.path)}`,
      };
    }));

    res.json({ article, photos });
  } catch (err) {
    console.error("Get photos error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get photos" });
  }
});

app.get("/api/warehouse/photo-proxy", async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const path = (req.query.path || "").toString();
    if (!path) { res.status(400).json({ error: "path query param is required" }); return; }

    const infoRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&fields=file,mime_type`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    if (!infoRes.ok) { res.status(404).json({ error: "File not found" }); return; }
    const info = await infoRes.json() as { file?: string; mime_type?: string };
    if (!info.file) { res.status(404).json({ error: "No download URL available" }); return; }

    const imgRes = await fetch(info.file);
    if (!imgRes.ok) { res.status(502).json({ error: "Failed to fetch image from Yandex" }); return; }

    res.setHeader("Content-Type", info.mime_type || imgRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(await imgRes.arrayBuffer()));
  } catch (err) {
    console.error("Photo proxy error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Proxy failed" });
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export default app;
