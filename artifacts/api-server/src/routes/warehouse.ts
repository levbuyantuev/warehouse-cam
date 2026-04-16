import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
    if (res.status === 403) {
      throw new Error("Токен Яндекс.Диска не имеет прав на запись файлов. Получите новый токен на: oauth.yandex.ru");
    }
    if (res.status === 401) {
      throw new Error("Токен Яндекс.Диска недействителен или истёк. Получите новый токен.");
    }
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

router.post("/warehouse/photo", upload.single("photo"), async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const article = (req.body?.article || "").toString().trim();
    const file = req.file;
    const folderParam = (req.body?.folder || "").toString().trim();
    const baseFolder = BASE_FOLDERS.includes(folderParam) ? folderParam : BASE_FOLDERS[0];

    if (!article) {
      res.status(400).json({ error: "Article number is required" });
      return;
    }
    if (!file) {
      res.status(400).json({ error: "Photo file is required" });
      return;
    }

    const ext = file.originalname.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const filename = `photo_${timestamp}.${ext}`;
    const filePath = `${baseFolder}/${article}/${filename}`;

    await createFolderIfNeeded(`${baseFolder}/${article}`, token);
    const uploadUrl = await getUploadUrl(filePath, token);
    await uploadToYandex(uploadUrl, file.buffer, file.mimetype);
    const publicUrl = await publishFile(filePath, token);

    res.json({ success: true, filename, publicUrl: publicUrl || "", folder: baseFolder });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    req.log.error({ err }, "Photo upload error");
    res.status(500).json({ error: message });
  }
});

// In-memory cache for the article list (refreshes every 10 minutes)
let catalogCache: { folders: { article: string; photoCount: number; coverProxyUrl: string }[]; ts: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchAllFolders(token: string): Promise<string[]> {
  type RawFolder = { type: string; name: string };

  const fetchPage = async (baseFolder: string, offset: number): Promise<{ items: RawFolder[]; total: number }> => {
    const folderPath = encodeURIComponent(baseFolder);
    const res = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${folderPath}&limit=1000&offset=${offset}&sort=name`,
      { headers: { Authorization: `OAuth ${token}` } }
    );
    if (!res.ok) return { items: [], total: 0 };
    const data = await res.json() as { _embedded?: { items?: RawFolder[]; total?: number } };
    return {
      items: (data._embedded?.items || []).filter(i => i.type === "dir"),
      total: data._embedded?.total ?? 0,
    };
  };

  const allNames: string[] = [];

  await Promise.all(BASE_FOLDERS.map(async (baseFolder) => {
    // First page to discover total
    const first = await fetchPage(baseFolder, 0);
    first.items.forEach(i => allNames.push(i.name));

    if (first.total > 1000) {
      const offsets: number[] = [];
      for (let o = 1000; o < first.total; o += 1000) offsets.push(o);
      // Fetch remaining pages in parallel (batches of 5 to avoid rate limiting)
      const BATCH = 5;
      for (let b = 0; b < offsets.length; b += BATCH) {
        const batch = offsets.slice(b, b + BATCH);
        const pages = await Promise.all(batch.map(o => fetchPage(baseFolder, o)));
        pages.forEach(p => p.items.forEach(i => allNames.push(i.name)));
      }
    }
  }));

  // Deduplicate and sort
  return [...new Set(allNames)].sort((a, b) => a.localeCompare(b, "ru"));
}

router.get("/warehouse/catalog", async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const forceRefresh = req.query.refresh === "1";

    // Serve from cache if fresh
    if (catalogCache && !forceRefresh && Date.now() - catalogCache.ts < CACHE_TTL_MS) {
      res.json({ folders: catalogCache.folders, cached: true });
      return;
    }

    const names = await fetchAllFolders(token);
    const folders = names.map(n => ({ article: n, photoCount: 0, coverProxyUrl: "" }));

    catalogCache = { folders, ts: Date.now() };
    res.json({ folders, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get catalog";
    req.log.error({ err }, "Catalog error");
    res.status(500).json({ error: message });
  }
});

router.get("/warehouse/photos/:article", async (req: Request, res: Response) => {
  try {
    const token = getToken();
    const { article } = req.params;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    type RawFile = { type: string; name: string; public_url?: string; path: string; preview?: string };

    const allFiles: RawFile[] = [];

    await Promise.all(BASE_FOLDERS.map(async (baseFolder) => {
      const folderPath = encodeURIComponent(`${baseFolder}/${article}`);
      const folderRes = await fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${folderPath}&limit=100&preview_size=M&preview_crop=false`,
        { headers: { Authorization: `OAuth ${token}` } }
      );
      if (!folderRes.ok) return;
      const data = await folderRes.json() as { _embedded?: { items?: RawFile[] } };
      const files = (data._embedded?.items || []).filter(i => i.type === "file");
      allFiles.push(...files);
    }));

    const photos = await Promise.all(allFiles.map(async file => {
      let publicUrl = file.public_url;
      if (!publicUrl) {
        publicUrl = await publishFile(file.path, token) || "";
      }
      const proxyPath = encodeURIComponent(file.path);
      const previewProxyUrl = `${baseUrl}/api/warehouse/photo-proxy?path=${proxyPath}`;
      return { name: file.name, publicUrl, previewProxyUrl };
    }));

    res.json({ article, photos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get photos";
    req.log.error({ err }, "Get photos error");
    res.status(500).json({ error: message });
  }
});

router.get("/warehouse/photo-proxy", async (req: Request, res: Response) => {
  const rawPath = req.query.path;
  const path = (rawPath || "").toString();

  req.log.info({ rawPath, path }, "[photo-proxy] incoming request");

  try {
    const token = getToken();

    if (!path) {
      res.status(400).json({ error: "path query param is required" });
      return;
    }

    // Use /resources/download – the correct Yandex Disk API endpoint for download URLs.
    // /resources?fields=file may not return the `file` field reliably for all file states.
    const yadEncoded = encodeURIComponent(path);
    const downloadApiUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${yadEncoded}`;

    req.log.info({ downloadApiUrl }, "[photo-proxy] calling Yandex download API");

    const dlRes = await fetch(downloadApiUrl, {
      headers: { Authorization: `OAuth ${token}` },
    });

    req.log.info({ status: dlRes.status }, "[photo-proxy] Yandex response");

    if (!dlRes.ok) {
      const errBody = await dlRes.text();
      req.log.error({ status: dlRes.status, path, errBody }, "[photo-proxy] Yandex error");
      res.status(dlRes.status === 404 ? 404 : 502).json({
        error: "Yandex Disk error",
        yandexStatus: dlRes.status,
        path,
        detail: errBody,
      });
      return;
    }

    const dlData = await dlRes.json() as { href?: string };
    const downloadUrl = dlData.href;

    req.log.info({ downloadUrl: downloadUrl?.slice(0, 80) }, "[photo-proxy] got download href");

    if (!downloadUrl) {
      req.log.error({ path, dlData }, "[photo-proxy] no href in Yandex response");
      res.status(502).json({ error: "No download href from Yandex", path });
      return;
    }

    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) {
      req.log.error({ status: imgRes.status }, "[photo-proxy] image fetch failed");
      res.status(502).json({ error: "Failed to fetch image from Yandex storage", status: imgRes.status });
      return;
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(Buffer.from(await imgRes.arrayBuffer()));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy failed";
    req.log.error({ err, path }, "[photo-proxy] exception");
    res.status(500).json({ error: message, path });
  }
});

export default router;
