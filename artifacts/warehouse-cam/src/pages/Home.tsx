import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, CheckCircle2, ChevronLeft, Image as ImageIcon, Box, RefreshCw, AlertCircle, X, ZoomIn } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadPhoto, useGetArticlePhotos, getGetArticlePhotosQueryKey } from "@workspace/api-client-react";
import { useSearch } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Step = 'article' | 'gallery' | 'preview' | 'success';
const FOLDERS = ["Avito", "Avito2", "ПЕРЕКИД_V1.0"] as const;
type Folder = typeof FOLDERS[number];

export default function Home() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  const [step, setStep] = useState<Step>('article');
  const [article, setArticle] = useState('');
  const [folder, setFolder] = useState<Folder>('Avito');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Pre-fill article from URL param (e.g. when navigating from Catalog)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const articleParam = params.get("article");
    if (articleParam && articleParam.trim().length > 0) {
      setArticle(articleParam.trim().toUpperCase());
      setStep('gallery');
    }
  }, [search]);

  // API Hooks
  const { data: galleryData, isLoading: isLoadingGallery, isError: isGalleryError } = useGetArticlePhotos(article, {
    query: {
      enabled: step === 'gallery' && article.length > 0,
    }
  });

  const uploadMutation = useUploadPhoto({
    mutation: {
      onSuccess: () => {
        // Invalidate gallery cache for this article
        queryClient.invalidateQueries({ queryKey: getGetArticlePhotosQueryKey(article) });
        setStep('success');
      },
    }
  });

  // Handlers
  const handleArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (article.trim().length > 0) {
      setStep('gallery');
    }
  };

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStep('preview');
    }
  };

  const handleUpload = () => {
    if (!article || !photoFile) return;
    
    uploadMutation.mutate({
      data: {
        article: article.trim(),
        folder: folder,
        photo: photoFile as any, // The generated client expects string format binary, which accepts File in FormData
      }
    });
  };

  const resetToArticle = () => {
    setArticle('');
    setPhotoFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStep('article');
    uploadMutation.reset();
  };

  const resetToGallery = () => {
    setPhotoFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStep('gallery');
    uploadMutation.reset();
  };

  // Variants for Framer Motion
  const pageVariants = {
    initial: { opacity: 0, x: 20, scale: 0.98 },
    in: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    out: { opacity: 0, x: -20, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col relative overflow-hidden">
      {/* Background Texture */}
      <div 
        className="absolute inset-0 z-0 opacity-40 pointer-events-none mix-blend-multiply"
        style={{ 
          backgroundImage: `url(${import.meta.env.BASE_URL}images/industrial-bg.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Hidden File Input for Camera */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* App Header */}
      <header className="relative z-10 pt-12 pb-6 px-6 flex items-center justify-center bg-gradient-to-b from-stone-200/80 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <Box className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl font-bold text-stone-800 tracking-tight">
            WarehouseCam
          </h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col px-4 pb-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: ARTICLE INPUT */}
          {step === 'article' && (
            <motion.div
              key="step-article"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex-1 flex flex-col justify-center"
            >
              <Card className="border-0 shadow-2xl shadow-stone-200/50">
                <CardContent className="pt-8 pb-8 px-6 flex flex-col gap-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-display font-bold text-stone-800">Введите артикул</h2>
                    <p className="text-stone-500 text-sm">Введите артикул товара, чтобы открыть папку на Яндекс.Диске.</p>
                  </div>
                  
                  <form onSubmit={handleArticleSubmit} className="flex flex-col gap-6">
                    <Input
                      autoFocus
                      value={article}
                      onChange={(e) => setArticle(e.target.value.toUpperCase())}
                      placeholder="напр. АРТ-12345"
                      className="h-20 text-center text-3xl font-display font-bold tracking-wider uppercase border-stone-300 shadow-inner bg-stone-50/50"
                    />
                    <Button 
                      type="submit" 
                      size="xl" 
                      disabled={article.trim().length === 0}
                      className="w-full"
                    >
                      Открыть папку
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: GALLERY & CAMERA TRIGGER */}
          {step === 'gallery' && (
            <motion.div
              key="step-gallery"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex-1 flex flex-col h-full"
            >
              <div className="flex items-center mb-4">
                <button 
                  onClick={resetToArticle}
                  className="p-3 -ml-3 rounded-full hover:bg-stone-200 active:bg-stone-300 transition-colors text-stone-600"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <div className="flex-1 ml-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Артикул</p>
                  <h2 className="text-2xl font-display font-bold text-stone-800">{article}</h2>
                </div>
              </div>

              {/* Folder toggle */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Загружать в папку
                </p>
                <div className="flex gap-2">
                  {FOLDERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFolder(f)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        folder === f
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                          : "bg-white text-stone-600 border-stone-200 hover:border-primary/50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-white rounded-3xl p-5 shadow-xl shadow-stone-200/50 border border-stone-200/50 flex flex-col mb-6 overflow-hidden">
                <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-stone-400" />
                  Фото на Яндекс.Диске
                </h3>
                
                <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2">
                  {isLoadingGallery ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-3">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                      <p>Загрузка фото…</p>
                    </div>
                  ) : isGalleryError ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-3 text-center">
                      <AlertCircle className="w-10 h-10 text-red-400" />
                      <p>Не удалось загрузить папку.<br/>Возможно, она пуста или не существует.</p>
                    </div>
                  ) : galleryData?.photos && galleryData.photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {galleryData.photos.map((photo, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxUrl(photo.previewProxyUrl)}
                          className="aspect-square rounded-xl bg-stone-100 overflow-hidden relative border border-stone-200 group focus:outline-none active:scale-95 transition-transform"
                        >
                          <img
                            src={photo.previewProxyUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 group-active:bg-black/30 transition-colors flex items-center justify-center">
                            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-3 text-center">
                      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-2">
                        <ImageIcon className="w-8 h-8 text-stone-300" />
                      </div>
                      <p className="font-medium text-stone-600">Папка пуста</p>
                      <p className="text-sm">Загрузите первое фото</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Massive Camera Button */}
              <div className="mt-auto pb-4">
                <Button 
                  size="massive" 
                  onClick={handleCaptureClick}
                  className="w-full gap-4 text-white shadow-2xl shadow-primary/30"
                >
                  <Camera className="w-8 h-8" />
                  Сделать фото
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PREVIEW & UPLOAD */}
          {step === 'preview' && previewUrl && (
            <motion.div
              key="step-preview"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex-1 flex flex-col h-full"
            >
              <div className="flex items-center mb-6">
                <button 
                  onClick={resetToGallery}
                  className="p-3 -ml-3 rounded-full hover:bg-stone-200 active:bg-stone-300 transition-colors text-stone-600"
                  disabled={uploadMutation.isPending}
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <div className="flex-1 text-center pr-8">
                  <h2 className="text-xl font-display font-bold text-stone-800">Предпросмотр</h2>
                </div>
              </div>

              <div className="flex-1 bg-black rounded-3xl overflow-hidden shadow-2xl mb-6 relative">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-contain"
                />
                
                {/* Upload Overlay */}
                {uploadMutation.isPending && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                    <RefreshCw className="w-12 h-12 animate-spin mb-4 text-primary" />
                    <h3 className="font-display font-bold text-xl mb-1">Загрузка на Яндекс…</h3>
                    <p className="text-white/70 text-sm">Пожалуйста, подождите</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-auto pb-4">
                <Button 
                  variant="secondary" 
                  size="xl" 
                  onClick={handleCaptureClick}
                  className="flex-1"
                  disabled={uploadMutation.isPending}
                >
                  Переснять
                </Button>
                <Button 
                  size="xl" 
                  onClick={handleUpload}
                  className="flex-[2] gap-3"
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="w-6 h-6" />
                  Загрузить
                </Button>
              </div>
              
              {uploadMutation.isError && (
                <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <div className="text-sm font-medium">
                    Ошибка загрузки. Проверьте соединение и попробуйте снова.
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <motion.div
              key="step-success"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="w-full max-w-sm">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                  className="w-32 h-32 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-500/20"
                >
                  <CheckCircle2 className="w-16 h-16" />
                </motion.div>
                
                <h2 className="text-4xl font-display font-bold text-stone-800 mb-3">Загружено!</h2>
                <p className="text-lg text-stone-500 mb-12">
                  Фото сохранено в папку <br/>
                  <strong className="text-stone-800 bg-stone-200 px-2 py-1 rounded-md">{folder}/{article}</strong>
                </p>

                <div className="flex flex-col gap-4">
                  <Button size="xl" onClick={resetToGallery} className="w-full gap-3">
                    <Camera className="w-6 h-6" />
                    Ещё фото
                  </Button>
                  <Button variant="outline" size="xl" onClick={resetToArticle} className="w-full">
                    Другой артикул
                  </Button>
                </div>
              </div>
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
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              src={lightboxUrl}
              alt="Full photo"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-w-full max-h-full object-contain select-none"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
