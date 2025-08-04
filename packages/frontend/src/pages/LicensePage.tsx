import React from 'react';
import {
  ArrowLeftIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface LicensePageProps {
  onBack?: () => void;
}

const LicensePage: React.FC<LicensePageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack || (() => window.history.back())}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <ScaleIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              License & Legal
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* License Hero */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-400 to-green-400 flex items-center justify-center">
              <ShieldCheckIcon className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              MIT License
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Open source software with minimal restrictions
            </p>
          </div>

          {/* License Text */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Full License Text
            </h3>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto">
              <pre className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {`MIT License

Copyright (c) 2025 Robert Allen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
              </pre>
            </div>
          </div>

          {/* What This Means */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg mb-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              What This Means for You
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-3">
                  ✅ You CAN:
                </h4>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li>• Use the software for any purpose</li>
                  <li>• Study and modify the source code</li>
                  <li>• Share and distribute the software</li>
                  <li>• Use it in commercial projects</li>
                  <li>• Create derivative works</li>
                  <li>• Sell copies or modified versions</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-3">
                  ⚠️ You MUST:
                </h4>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li>• Include the original license</li>
                  <li>• Include the copyright notice</li>
                  <li>• Not hold the authors liable</li>
                  <li>• Understand there's no warranty</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Additional Legal Information */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-8 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Additional Legal Information
            </h3>

            <div className="prose dark:prose-invert max-w-none">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Privacy & Data Usage
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Cartrita is designed with privacy in mind. Your conversations
                and personal data are stored locally in your own database
                instance. While the software may integrate with third-party APIs
                (like OpenAI), you have full control over what data is shared
                and how it's used.
              </p>

              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Third-Party Services
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                This software may integrate with various third-party services
                (OpenAI, Deepgram, etc.). Use of those services is subject to
                their respective terms of service and privacy policies. You are
                responsible for compliance with those terms.
              </p>

              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Ethical AI Commitment
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                While this project uses the MIT License, we encourage all users
                and contributors to develop and deploy AI technology
                responsibly. This includes respecting user privacy, promoting
                fairness, avoiding harmful applications, and being transparent
                about AI capabilities and limitations.
              </p>

              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Contact & Support
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                This is open-source software provided as-is. For questions,
                issues, or contributions, please visit the project repository or
                contact the maintainers through the appropriate channels.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicensePage;
