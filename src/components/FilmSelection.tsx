import React from 'react';
import { Button } from "@/components/ui/button";

interface FilmSelectionProps {
  selectedFilm: string;
  onFilmSelect: (filmId: string) => void;
}

const FILM_OPTIONS = [
  { id: 'moru', name: '모루 필름', price: 10000 },
  { id: 'dot', name: '도트 필름', price: 10000 }
];

const FilmSelection: React.FC<FilmSelectionProps> = ({
  selectedFilm,
  onFilmSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">필름을 선택해주세요</h3>
        <p className="text-gray-600">원하시는 필름 종류를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FILM_OPTIONS.map((film) => (
          <Button
            key={film.id}
            variant={selectedFilm === film.id ? "default" : "outline"}
            className={`h-20 text-lg font-semibold transition-all duration-200 rounded-lg flex flex-col items-center justify-center ${
              selectedFilm === film.id
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
            }`}
            onClick={() => onFilmSelect(film.id)}
          >
            <span>{film.name}</span>
            <span className="text-sm opacity-80 mt-1">+₩{film.price.toLocaleString()}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default FilmSelection;
