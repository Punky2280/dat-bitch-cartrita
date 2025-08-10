import React, { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  requireTextConfirmation?: boolean;
  textToConfirm?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  requireTextConfirmation = false,
  textToConfirm = "",
}) => {
  const [confirmationText, setConfirmationText] = useState("");

  if (!isOpen) return null;

  const isConfirmDisabled = 
    requireTextConfirmation && 
    confirmationText.toLowerCase() !== textToConfirm.toLowerCase();

  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm();
      setConfirmationText("");
    }
  };

  const handleClose = () => {
    onClose();
    setConfirmationText("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`text-2xl ${destructive ? 'text-red-400' : 'text-yellow-400'}`}>
            {destructive ? '⚠️' : '❓'}
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        
        <p className="text-gray-300 mb-6">{message}</p>

        {requireTextConfirmation && (
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-2">
              Type "{textToConfirm}" to confirm:
            </p>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
              placeholder={textToConfirm}
              autoFocus
            />
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};