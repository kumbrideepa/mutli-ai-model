import { useState } from "react";
import { X } from "lucide-react";

const galleryImages = [
  { id: 1, title: "Cosmic Nebula", prompt: "cosmic nebula deep space purple blue" },
  { id: 2, title: "Taj Mahal Sunset", prompt: "taj mahal golden sunset" },
  { id: 3, title: "Neural Network", prompt: "neural network visualization blue" },
  { id: 4, title: "Kerala Backwaters", prompt: "kerala backwaters peaceful" },
  { id: 5, title: "Digital Garden", prompt: "digital garden neon plants" },
  { id: 6, title: "Himalayan Peaks", prompt: "himalayan mountain peaks snow" },
  { id: 7, title: "Circuit Board Art", prompt: "circuit board macro art" },
  { id: 8, title: "Rajasthani Colors", prompt: "rajasthan colorful market" },
  { id: 9, title: "Aurora Borealis", prompt: "aurora borealis northern lights" },
  { id: 10, title: "Lotus Temple", prompt: "lotus temple delhi modern" },
  { id: 11, title: "Quantum Waves", prompt: "quantum wave particles blue" },
  { id: 12, title: "Spice Market", prompt: "indian spice market colorful" },
  { id: 13, title: "Crystal Cave", prompt: "crystal cave glowing purple" },
  { id: 14, title: "Varanasi Ghats", prompt: "varanasi ghats sunrise" },
  { id: 15, title: "Holographic City", prompt: "holographic futuristic city" },
];

// Use picsum with seed for consistent images
const getImageUrl = (id: number) =>
  `https://picsum.photos/seed/aistudio${id}/600/400`;

interface GalleryPageProps {
  language: "en" | "hi" | "kn";
}

export default function GalleryPage({ language }: GalleryPageProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border/30">
        <h1 className="font-display text-xl font-semibold">
          {language === "hi" ? "गैलरी" : language === "kn" ? "ಗ್ಯಾಲರಿ" : "Gallery"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {language === "hi" ? "AI-प्रेरित छवि संग्रह" : language === "kn" ? "AI-ಪ್ರೇರಿತ ಚಿತ್ರ ಸಂಗ್ರಹ" : "AI-inspired image collection"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {galleryImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelected(img.id)}
              className={`group glass-card overflow-hidden aspect-[3/2] relative animate-reveal`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <img
                src={getImageUrl(img.id)}
                alt={img.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                <span className="text-sm font-medium text-white">{img.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-reveal"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-3xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={getImageUrl(selected)}
              alt={galleryImages.find((i) => i.id === selected)?.title}
              className="rounded-xl max-h-[80vh] w-auto object-contain"
            />
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-center mt-3 font-display text-lg">
              {galleryImages.find((i) => i.id === selected)?.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
