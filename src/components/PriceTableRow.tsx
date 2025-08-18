
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceCombination } from "@/utils/priceCombinations";
import { formatPrice } from "@/utils/priceCalculations";

interface PriceTableRowProps {
  combination: PriceCombination;
  price?: number;
  isEditing: boolean;
  editingPrice: string;
  onEditStart: (key: string, currentPrice: number) => void;
  onEditChange: (price: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

const PriceTableRow: React.FC<PriceTableRowProps> = ({
  combination,
  price,
  isEditing,
  editingPrice,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel
}) => {
  const handleEditStart = () => {
    if (price !== undefined) {
      onEditStart(combination.key, price);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEditSave();
    } else if (e.key === 'Escape') {
      onEditCancel();
    }
  };

  return (
    <TableRow>
      <TableCell>{combination.material}</TableCell>
      <TableCell>{combination.quality}</TableCell>
      <TableCell>{combination.thickness}</TableCell>
      <TableCell>{combination.size}</TableCell>
      <TableCell>{combination.surface}</TableCell>
      <TableCell>{combination.colorType || '-'}</TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={editingPrice}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-32"
            autoFocus
          />
        ) : (
          <span className={price ? '' : 'text-gray-400'}>
            {price ? formatPrice(price) : '미설정'}
          </span>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={onEditSave}>저장</Button>
            <Button size="sm" variant="outline" onClick={onEditCancel}>취소</Button>
          </div>
        ) : (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleEditStart}
            disabled={price === undefined}
          >
            편집
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

export default PriceTableRow;
