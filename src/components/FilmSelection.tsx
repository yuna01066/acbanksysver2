import React from 'react';
import { Button } from "@/components/ui/button";

interface FilmSelectionProps {
  selectedFilm: string;
  onFilmSelect: (film: string) => void;
}

const FILM_OPTIONS = [
  { id: 'moru-film', name: '모루 필름', price: 10000 },
  { id: 'dot-film', name: '도트 필름', price: 10000 }
];

const FilmSelection: React.FC<FilmSelectionProps> = ({
  selectedFilm,
  onFilmSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          필름을 선택해주세요
        </h3>
        <p className="text-gray-600">원하시는 필름 종류를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FILM_OPTIONS.map((film) => (
          <Button
            key={film.id}
            variant={selectedFilm === film.id ? "default" : "minimal"}
            className="h-24 flex-col gap-2 text-lg font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
            onClick={() => onFilmSelect(film.id)}
          >
            <span>{film.name}</span>
            <span className="text-sm text-muted-foreground">
              +{film.price.toLocaleString()}원
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default FilmSelection;
