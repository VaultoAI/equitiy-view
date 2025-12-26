'use client';

interface PriceRangeSelectorProps {
  lowerPrice: number;
  upperPrice: number;
  onLowerChange: (price: number) => void;
  onUpperChange: (price: number) => void;
  currentPrice?: number;
}

export function PriceRangeSelector({
  lowerPrice,
  upperPrice,
  onLowerChange,
  onUpperChange,
  currentPrice,
}: PriceRangeSelectorProps) {
  const handleFullRange = () => {
    onLowerChange(0);
    onUpperChange(Infinity);
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium">Price Range</label>
        <button
          onClick={handleFullRange}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Full Range
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Min Price</label>
          <input
            type="number"
            value={lowerPrice === 0 ? '' : lowerPrice}
            onChange={(e) => onLowerChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        {currentPrice && (
          <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Current Price: {currentPrice.toFixed(6)}
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Max Price</label>
          <input
            type="number"
            value={upperPrice === Infinity ? '' : upperPrice}
            onChange={(e) => onUpperChange(parseFloat(e.target.value) || Infinity)}
            placeholder="∞"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}


