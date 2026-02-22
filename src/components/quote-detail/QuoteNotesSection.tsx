import React from 'react';

interface QuoteNotesSectionProps {
  notes: string;
  consultation: string;
  viewMode: 'internal' | 'customer';
}

const QuoteNotesSection: React.FC<QuoteNotesSectionProps> = ({ notes, consultation, viewMode }) => {
  if (viewMode === 'customer') return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 quote-section">
      <div className="bg-[hsl(45,55%,92%)] rounded-lg border border-[hsl(45,40%,78%)] p-4">
        <h3 className="text-[14px] font-bold mb-2 text-black">특 이 사 항 :</h3>
        <ul className="text-[13px] space-y-1 text-black">
          {notes.split('\n').map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
      
      <div className="bg-[hsl(45,55%,92%)] rounded-lg border border-[hsl(45,40%,78%)] p-4">
        <h3 className="text-[14px] font-bold mb-2 text-black">상 담 내 용 :</h3>
        <div className="text-[13px] space-y-1 text-black">
          {consultation.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuoteNotesSection;
