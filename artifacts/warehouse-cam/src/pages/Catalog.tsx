import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box, RefreshCw, AlertCircle, ChevronLeft, ChevronRight,
  Image as ImageIcon, Camera, Search, X, ZoomIn, Package, Plus
} from "lucide-react";
import { useGetCatalog, useGetArticlePhotos } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

type View = "grid" | "article";

export default function Catalog() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<View>("grid");
  const [selectedArticle, setSelectedArticle] = useState<string>("");
  const [search, setSearch] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: catalogData, isLoading, isError, refetch } = useGetCatalog();

  const { data: photosData, isLoading: isLoadingPhotos } = useGetArticlePhotos(selectedArticle, {
    query: { enabled: view === "article" && !!selectedArticle }
  });

  const folders = (catalogData?.folders ?? []).filter(f =>
    f.article.toLowerCase().includes(search.toLowerCase())
  );

  const photos = photosData?.photos ?? [];

  const openArticle = (article: string) => {
    setSelectedArticle(article);
    setView("article");
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxUrl(photos[index]?.previewProxyUrl ?? null);
  };

  const lightboxNext = () => {
    const next = (lightboxIndex + 1) % photos.length;
    setLightboxIndex(next);
    setLightboxUrl(photos[next]?.previewProxyUrl ?? null);
  };

  const lightboxPrev = () => {
    const prev = (lightboxIndex - 1 + photos.length) % photos.length;
    setLightboxIndex(prev);
    setLightboxUrl(photos[prev]?.previewProxyUrl ?? null);
  };

  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    in: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
    out: { opacity: 0, y: -12, transition: { duration: 0.18 } }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 z-0 opacity-40 pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}images/industrial-bg.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      />

      {/* Header */}
      <header className="relative z-10 pt-10 pb-4 px-4 bg-gradient-to-b from-stone-200/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <Box className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-stone-800 leading-tight">Каталог Avito</h1>
            <p className="text-xs text-stone-500">
              {isLoading ? "Загрузка…" : `${catalogData?.folders.length ?? 0} артикулов`}
            </p>
          </div>
          {view === "article" && (
            <button
              onClick={() => setView("grid")}
              className="p-2 rounded-full hover:bg-stone-200 active:bg-stone-300 transition-colors text-stone-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
        </div>

        {view === "grid" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Поиск артикула…"
              className="pl-9 h-10 bg-white/80 border-stone-200 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {view === "article" && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary shrink-0" />
            <span className="font-display font-bold text-stone-800 text-lg">{selectedArticle}</span>
            <span className="text-sm text-stone-400 ml-1">
              {isLoadingPhotos ? "" : `(${photos.length})`}
            </span>
            <Button
              size="sm"
              className="ml-auto gap-1.5 shrink-0"
              onClick={() => navigate(`/?article=${encodeURIComponent(selectedArticle)}`)}
            >
              <Plus className="w-4 h-4" />
              Добавить фото
            </Button>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-8">
        <AnimatePresence mode="wait">
          {/* GRID VIEW */}
          {view === "grid" && (
            <motion.div key="grid" variants={pageVariants} initial="initial" animate="in" exit="out">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <p>Загружаю каталог…</p>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-4 text-center">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                  <p>Не удалось загрузить каталог</p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Повторить
                  </Button>
                </div>
              ) : folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3 text-center">
                  <ImageIcon className="w-10 h-10 text-stone-300" />
                  <p>{search ? `Артикул «${search}» не найден` : "Каталог пуст"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {folders.map((folder, i) => (
                    <motion.button
                      key={folder.article}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      onClick={() => openArticle(folder.article)}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200/60 flex flex-col text-left active:scale-95 transition-transform focus:outline-none"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-stone-100 relative overflow-hidden">
                        {folder.coverProxyUrl ? (
                          <img
                            src={folder.coverProxyUrl}
                            alt={folder.article}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-10 h-10 text-stone-300" />
                          </div>
                        )}
                        {/* Photo count badge */}
                        {folder.photoCount > 0 && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                            {folder.photoCount}
                          </div>
                        )}
                      </div>
                      {/* Label */}
                      <div className="px-3 py-2.5">
                        <p className="font-display font-bold text-stone-800 text-sm truncate">{folder.article}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {folder.photoCount === 0 ? "Нет фото" : `${folder.photoCount} фото`}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ARTICLE VIEW */}
          {view === "article" && (
            <motion.div key="article" variants={pageVariants} initial="initial" animate="in" exit="out">
              {isLoadingPhotos ? (
                <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <p>Загружаю фото…</p>
                </div>
              ) : photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3 text-center">
                  <Camera className="w-10 h-10 text-stone-300" />
                  <p className="font-medium text-stone-600">Фото не загружены</p>
                  <p className="text-sm">Сделайте фото через раздел «Фото»</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-4">
                  {photos.map((photo, i) => (
                    <motion.button
                      key={photo.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      onClick={() => openLightbox(i)}
                      className="group aspect-square rounded-2xl overflow-hidden bg-stone-200 relative shadow-sm border border-stone-200/60 focus:outline-none active:scale-95 transition-transform"
                    >
                      <img
                        src={photo.previewProxyUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-md font-mono">
                        {i + 1}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/97 flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full z-10">
              {lightboxIndex + 1} / {photos.length}
            </div>

            {/* Prev */}
            {photos.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); lightboxPrev(); }}
                className="absolute left-3 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Image */}
            <motion.img
              key={lightboxUrl}
              src={lightboxUrl}
              alt={`Фото ${lightboxIndex + 1}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
              className="max-w-full max-h-full object-contain select-none px-16"
              onClick={e => e.stopPropagation()}
            />

            {/* Next */}
            {photos.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); lightboxNext(); }}
                className="absolute right-3 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
