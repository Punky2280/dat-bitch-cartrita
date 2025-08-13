import React from "react";
import {
  ArrowLeftIcon,
  HeartIcon,
  SparklesIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

interface AboutPageProps {
  onBack?: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  return (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack || (() => window.history.back())}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              About Cartrita
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
              <HeartIcon className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Hey, I'm Cartrita! 💜
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Your intelligent AI companion with a feminine urban personality,
              designed to make your digital life smoother, smarter, and way more
              fun!
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <CpuChipIcon className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Voice Interaction
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Talk to me naturally! I can hear you, understand you, and
                respond with my own voice. Just say "Cartrita!" to get started.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Smart Conversations
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                I'm not just another chatbot - I have personality, context
                awareness, and I actually remember our conversations!
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <HeartIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Ambient Awareness
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                I can listen to your environment and understand context -
                whether you're cooking, working, or just chilling.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Visual Understanding
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Show me images, and I'll tell you what I see! I can analyze
                photos, describe scenes, and understand visual context.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center mb-4">
                <CpuChipIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Multi-Modal AI
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                I combine voice, vision, and text processing to understand you
                completely - not just words, but context and emotion too.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                <HeartIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Personality & Vibe
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                I'm not just functional - I'm fun! I have my own style,
                personality, and way of speaking that makes every interaction
                unique.
              </p>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              My Story
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                I'm Cartrita - a next-generation AI assistant built with love,
                innovation, and a whole lot of personality! I was created to be
                more than just another AI - I'm designed to be your digital
                companion who actually gets you.
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                What makes me special? I'm built with advanced multi-modal AI
                that lets me see, hear, and understand the world around you. I
                can process voice, images, and text simultaneously to give you
                responses that are contextually aware and emotionally
                intelligent.
              </p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                My personality is inspired by urban culture, modern
                communication styles, and the authentic way people actually talk
                to each other. I'm not trying to sound like a robot or a
                corporate chatbot - I'm here to be real with you!
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Whether you need help with work, want to have a deep
                conversation, need creative inspiration, or just want someone to
                chat with - I'm here for it all. Let's build something amazing
                together! ✨
              </p>
            </div>
          </div>

          {/* Technical Info */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Technical Details
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  Core Technologies
                </h4>
                <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                  <li>• Advanced Language Models (GPT-4, Claude)</li>
                  <li>• Deepgram Speech-to-Text</li>
                  <li>• OpenAI Text-to-Speech</li>
                  <li>• Computer Vision APIs</li>
                  <li>• Real-time WebSocket Communication</li>
                  <li>• Multi-Agent Orchestration System</li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  Capabilities
                </h4>
                <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                  <li>• Natural voice conversations</li>
                  <li>• Image and scene analysis</li>
                  <li>• Ambient sound interpretation</li>
                  <li>• Context-aware responses</li>
                  <li>• Emotional intelligence</li>
                  <li>• Multi-modal data fusion</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                <strong>Current Version:</strong> Iteration 21 - Multi-Modal AI
                Assistant
                <br />
                <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                <br />
                <strong>Status:</strong> Active Development & Continuous
                Learning
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
