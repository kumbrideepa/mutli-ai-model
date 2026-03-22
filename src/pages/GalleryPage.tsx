import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const galleryImages = [
  { id: 1, title: "Taj Mahal", location: "Agra", prompt: "taj mahal agra india marble" },
  { id: 2, title: "Hawa Mahal", location: "Jaipur", prompt: "hawa mahal jaipur pink city" },
  { id: 3, title: "Golden Temple", location: "Amritsar", prompt: "golden temple amritsar india" },
  { id: 4, title: "Lotus Temple", location: "Delhi", prompt: "lotus temple delhi bahai" },
  { id: 5, title: "Mysore Palace", location: "Mysuru", prompt: "mysore palace karnataka india" },
  { id: 6, title: "Gateway of India", location: "Mumbai", prompt: "gateway of india mumbai" },
  { id: 7, title: "Hampi Ruins", location: "Karnataka", prompt: "hampi ruins karnataka ancient" },
  { id: 8, title: "Qutub Minar", location: "Delhi", prompt: "qutub minar delhi tower" },
  { id: 9, title: "Meenakshi Temple", location: "Madurai", prompt: "meenakshi temple madurai colorful" },
  { id: 10, title: "Red Fort", location: "Delhi", prompt: "red fort delhi india" },
  { id: 11, title: "Jaisalmer Fort", location: "Rajasthan", prompt: "jaisalmer fort golden city" },
  { id: 12, title: "Varanasi Ghats", location: "Varanasi", prompt: "varanasi ghats ganges river" },
  { id: 13, title: "Khajuraho Temples", location: "Madhya Pradesh", prompt: "khajuraho temples india" },
  { id: 14, title: "Kerala Backwaters", location: "Kerala", prompt: "kerala backwaters houseboat" },
  { id: 15, title: "Konark Sun Temple", location: "Odisha", prompt: "konark sun temple odisha" },
];

const getImageUrl = (id: number, size: string = "600/400") =>
  `https://picsum.photos/seed/india${id * 7}/` + size;

interface GalleryPageProps {
  language: "en" | "hi" | "kn";
}

export default function GalleryPage({ language }: GalleryPageProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const selectedIdx = selected !== null ? galleryImages.findIndex((i) => i.id === selected) : -1;
  const selectedImg = selectedIdx >= 0 ? galleryImages[selectedIdx] : null;

  const navigate = (dir: number) => {
    const next = (selectedIdx + dir + galleryImages.length) % galleryImages.length;
    setSelected(galleryImages[next].id);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-5 border-b border-border/30">
        <h1 className="font-display text-xl font-semibold">
          {language === "hi" ? "भारतीय स्मारक गैलरी" : language === "kn" ? "ಭಾರತೀಯ ಸ್ಮಾರಕ ಗ್ಯಾಲರಿ" : "Indian Landmarks Gallery"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "hi"
            ? "भारत की सबसे प्रतिष्ठित विरासत स्थलों की खोज करें"
            : language === "kn"
            ? "ಭಾರತದ ಅತ್ಯಂತ ಪ್ರತಿಷ್ಠಿತ ಪರಂಪರೆ ತಾಣಗಳನ್ನು ಅನ್ವೇಷಿಸಿ"
            : "Discover India's most iconic heritage sites"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {galleryImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelected(img.id)}
              className="group relative overflow-hidden rounded-xl animate-reveal focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aspect-[3/2]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Glass card background */}
              <div className="absolute inset-0 glass-card" />
              <img
                src={getImageUrl(img.id)}
                alt={img.title}
                className="relative w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1 p-3">
                <span className="font-display text-sm font-semibold text-foreground">{img.title}</span>
                <span className="text-xs text-muted-foreground">{img.location}</span>
              </div>
              {/* Bottom label (always visible) */}
              <div className="absolute bottom-0 inset-x-0 p-2.5 rounded-b-xl" style={{ background: 'hsla(var(--glass-bg) / 0.85)', backdropFilter: 'blur(12px)' }}>
                <p className="text-xs font-medium text-foreground truncate">{img.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selected && selectedImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-reveal"
          style={{ background: 'hsla(var(--background) / 0.9)', backdropFilter: 'blur(24px)' }}
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-3xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="glass-card overflow-hidden">
              <img
                src={getImageUrl(selected, "900/600")}
                alt={selectedImg.title}
                className="max-h-[70vh] w-auto object-contain"
              />
              <div className="p-4">
                <p className="font-display text-lg font-semibold">{selectedImg.title}</p>
                <p className="text-sm text-muted-foreground">{selectedImg.location}</p>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Nav arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-9 h-9 rounded-full glass flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}