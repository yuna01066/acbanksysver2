
import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PricingData } from "@/types/pricing";
import { PriceCombination } from "@/utils/priceCombinations";
import PriceTableRow from "./PriceTableRow";

interface PriceTableProps {
  combinations: PriceCombination[];
  pricingData: PricingData;
  editingKey: string;
  editingPrice: string;
  onEditStart: (key: string, currentPrice: number) => void;
  onEditChange: (price: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

const PriceTable: React.FC<PriceTableProps> = ({
  combinations,
  pricingData,
  editingKey,
  editingPrice,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel
}) => {
  return (
    <div className="mb-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>소재</TableHead>
            <TableHead>재질</TableHead>
            <TableHead>두께</TableHead>
            <TableHead>사이즈</TableHead>
            <TableHead>면수</TableHead>
            <TableHead>색상타입</TableHead>
            <TableHead>가격</TableHead>
            <TableHead>액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combinations.map((combination) => (
            <PriceTableRow
              key={combination.key}
              combination={combination}
              price={pricingData[combination.key]}
              isEditing={editingKey === combination.key}
              editingPrice={editingPrice}
              onEditStart={onEditStart}
              onEditChange={onEditChange}
              onEditSave={onEditSave}
              onEditCancel={onEditCancel}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PriceTable;
