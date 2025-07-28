import React from 'react';

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
}

/**
 * A visual indicator that pulses to signify that the agent is speaking.
 * It renders a multi-layered, colored orb with a soft pulse animation.
 * @param {isSpeaking} - Controls the visibility and animation of the indicator.
 */
const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({ isSpeaking }) => {
  // Use a transition for smooth fade-in/out
  const baseClasses = 'absolute rounded-full transition-opacity duration-300';

  return (
    <div className="relative h-24 w-24 flex items-center justify-center">
      {/* Each div is a layer of the orb, with different sizes and animation delays to create a fluid, breathing effect. */}
      <div className={`${baseClasses} h-full w-full bg-blue-500 ${isSpeaking ? 'animate-pulse-orb-1 opacity-30' : 'opacity-0'}`}></div>
      <div className={`${baseClasses} h-5/6 w-5/6 bg-cyan-400 ${isSpeaking ? 'animate-pulse-orb-2 opacity-40' : 'opacity-0'}`}></div>
      <div className={`${baseClasses} h-2/3 w-2/3 bg-white ${isSpeaking ? 'animate-pulse-orb-3 opacity-50' : 'opacity-0'}`}></div>
    </div>
  );
};

export default SpeakingIndicator;