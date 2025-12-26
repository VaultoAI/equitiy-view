'use client';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  status,
  message,
}: TransactionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Transaction Status</h2>
        <div className="mb-4">
          {status === 'pending' && (
            <div className="text-blue-600">Processing transaction...</div>
          )}
          {status === 'success' && (
            <div className="text-green-600">Transaction successful!</div>
          )}
          {status === 'error' && (
            <div className="text-red-600">Transaction failed: {message}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}


