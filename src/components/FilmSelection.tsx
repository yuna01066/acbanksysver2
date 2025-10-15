import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Film } from "lucide-react";

interface FilmSelectionProps {
  selectedFilm: string;
  onFilmSelect: (filmId: string) => void;
}

const FILM_OPTIONS = [
  {
    id: 'moru',
    name: '모루 필름',
    description: '모루 질감의 필름',
    price: 10000
  },
  {
    id: 'dot',
    name: '도트 필름',
    description: '도트 패턴 필름',
    price: 10000
  }
];

const FilmSelection: React.FC<FilmSelectionProps> = ({
  selectedFilm,
  onFilmSelect
}) => {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Film className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-semibold">필름 선택</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FILM_OPTIONS.map((film) => (
          <Card
            key={film.id}
            className={`cursor-pointer transition-all duration-300 hover:scale-105 ${
              selectedFilm === film.id
                ? 'ring-2 ring-primary shadow-elegant'
                : 'hover:shadow-smooth'
            }`}
            onClick={() => onFilmSelect(film.id)}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-lg font-semibold">{film.name}</h4>
                <span className="text-primary font-bold">
                  +{film.price.toLocaleString()}원
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{film.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border/50">
        <p className="text-sm text-muted-foreground">
          필름을 선택하시면 추가 비용이 발생합니다.
        </p>
      </div>
    </div>
  );
};

export default FilmSelection;
