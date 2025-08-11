import React, { useState } from 'react';

interface SecurityMaskingControlsProps {
  maskedValue: string; // e.g., **********ABCD
  fullValue?: string;  // Provided only after secure fetch
  isRevealedInitially?: boolean;
  onReveal?: () => Promise<string | null>; // returns full secret or null
  onCopy?: (value: string) => void;
  onMaskChange?: (mode: MaskMode) => void;
  mode?: MaskMode;
  disabled?: boolean;
}

export type MaskMode = 'MASKED' | 'PARTIAL' | 'UNMASKED_ONCE';

const MODE_LABELS: Record<MaskMode,string> = {
  MASKED: 'Masked',
  PARTIAL: 'Partial',
  UNMASKED_ONCE: 'Reveal Once'
};

export const SecurityMaskingControls: React.FC<SecurityMaskingControlsProps> = ({
  maskedValue,
  fullValue,
  isRevealedInitially = false,
  onReveal,
  onCopy,
  onMaskChange,
  mode = 'MASKED',
  disabled
}) => {
  const [revealed, setRevealed] = useState(isRevealedInitially);
  const [value, setValue] = useState(revealed && fullValue ? fullValue : maskedValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    if (revealed) return;
    if (!onReveal) return;
    setIsLoading(true);
    setError(null);
    try {
      const v = await onReveal();
      if (v) {
        setValue(v);
        setRevealed(true);
        if (mode === 'UNMASKED_ONCE') {
          // Auto-remask after 20s
          setTimeout(() => {
            setValue(maskedValue);
            setRevealed(false);
          }, 20000);
        }
      } else {
        setError('Unable to reveal value');
      }
    } catch (e:any) {
      setError(e.message || 'Reveal failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if(!revealed) return; // copy only revealed
    if(onCopy) onCopy(value);
    try { navigator.clipboard.writeText(value); } catch { /* ignore */ }
  };

  const handleModeChange = (newMode: MaskMode) => {
    if(onMaskChange) onMaskChange(newMode);
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center space-x-2'>
        <select
          disabled={disabled}
            className='bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-green-500'
            value={mode}
            onChange={e=>handleModeChange(e.target.value as MaskMode)}
        >
          {Object.entries(MODE_LABELS).map(([k,label])=> <option key={k} value={k}>{label}</option>)}
        </select>
        <div className='flex-1 font-mono bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm overflow-x-auto select-none'>
          {value}
        </div>
        <button
          disabled={disabled || revealed || !onReveal}
          onClick={handleReveal}
          className={`px-3 py-2 rounded text-xs font-medium ${revealed? 'bg-gray-700 text-gray-400':'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
        >
          {isLoading ? '…' : (revealed ? 'Revealed' : 'Reveal')}
        </button>
        <button
          disabled={disabled || !revealed}
          onClick={handleCopy}
          className='px-3 py-2 rounded text-xs font-medium bg-gray-600 hover:bg-gray-500 disabled:opacity-50'
        >Copy</button>
      </div>
      {mode === 'UNMASKED_ONCE' && <div className='text-[10px] text-yellow-400'>Auto-remasks after 20s</div>}
      {error && <div className='text-xs text-red-400'>{error}</div>}
    </div>
  );
};

export default SecurityMaskingControls;
