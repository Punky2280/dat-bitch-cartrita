import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAmbient } from '@/context/AmbientContext';

interface AmbientSettingsProps {
  token: string;
}

export const AmbientSettings: React.FC<AmbientSettingsProps> = ({ token }) => {
  const { t } = useTranslation();
  const {
    isAmbientModeEnabled,
    permissionState,
    settings,
    enableAmbientMode,
    disableAmbientMode,
    updateSettings,
  } = useAmbient();

  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(settings);
  const [hasReadPrivacyInfo, setHasReadPrivacyInfo] = useState(false);

  useEffect(() => {
    setPendingSettings(settings);
  }, [settings]);

  const handleToggleAmbient = async () => {
    if (isAmbientModeEnabled) {
      disableAmbientMode();
    } else {
      // Show consent dialog before enabling
      setShowConsentDialog(true);
    }
  };

  const handleConsentAccept = async () => {
    if (!hasReadPrivacyInfo) {
      alert(t('ambient.pleaseReadPrivacy'));
      return;
    }

    try {
      await enableAmbientMode(token, pendingSettings);
      setShowConsentDialog(false);
    } catch (error) {
      console.error('Failed to enable ambient mode:', error);
      alert(t('ambient.enableError'));
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...pendingSettings, [key]: value };
    setPendingSettings(newSettings);

    if (isAmbientModeEnabled) {
      updateSettings(newSettings);
    }
  };

  const ConsentDialog = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {t('ambient.consentTitle')}
        </h3>

        <div className="space-y-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              {t('ambient.whatWillBeProcessed')}
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              {pendingSettings.audioEnabled && (
                <li>• {t('ambient.audioProcessing')}</li>
              )}
              {pendingSettings.videoEnabled && (
                <li>• {t('ambient.videoProcessing')}</li>
              )}
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
              {t('ambient.privacyProtections')}
            </h4>
            <ul className="text-sm text-green-800 dark:text-green-300 space-y-1">
              <li>• {t('ambient.noDataStorage')}</li>
              <li>• {t('ambient.localProcessing')}</li>
              <li>• {t('ambient.optionalFeature')}</li>
              <li>• {t('ambient.disableAnytime')}</li>
              {pendingSettings.privacyMode === 'enhanced' && (
                <li>• {t('ambient.enhancedPrivacy')}</li>
              )}
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">
              {t('ambient.riskConsiderations')}
            </h4>
            <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
              <li>• {t('ambient.micCameraAccess')}</li>
              <li>• {t('ambient.ambientListening')}</li>
              <li>• {t('ambient.behaviorAnalysis')}</li>
            </ul>
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={hasReadPrivacyInfo}
              onChange={e => setHasReadPrivacyInfo(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('ambient.confirmUnderstanding')}
            </span>
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowConsentDialog(false)}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConsentAccept}
            disabled={!hasReadPrivacyInfo}
            className={`px-6 py-2 rounded-lg font-medium ${
              hasReadPrivacyInfo
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {t('ambient.enableAmbientMode')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('ambient.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('ambient.description')}
          </p>
        </div>
        <button
          onClick={handleToggleAmbient}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isAmbientModeEnabled
              ? 'bg-blue-600'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isAmbientModeEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Permission Status */}
      {permissionState !== 'prompt' && (
        <div
          className={`p-3 rounded-lg ${
            permissionState === 'granted'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                permissionState === 'granted' ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {permissionState === 'granted'
              ? t('ambient.permissionGranted')
              : t('ambient.permissionDenied')}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {t('ambient.capabilities')}
        </h4>

        {/* Audio Settings */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ambient.audioListening')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('ambient.audioDescription')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={pendingSettings.audioEnabled}
            onChange={e =>
              handleSettingChange('audioEnabled', e.target.checked)
            }
            className="rounded"
          />
        </div>

        {/* Video Settings */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ambient.visualAnalysis')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('ambient.videoDescription')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={pendingSettings.videoEnabled}
            onChange={e =>
              handleSettingChange('videoEnabled', e.target.checked)
            }
            className="rounded"
          />
        </div>

        {/* Proactive Responses */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ambient.proactiveResponses')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('ambient.proactiveDescription')}
            </p>
          </div>
          <input
            type="checkbox"
            checked={pendingSettings.proactiveResponses}
            onChange={e =>
              handleSettingChange('proactiveResponses', e.target.checked)
            }
            className="rounded"
          />
        </div>

        {/* Privacy Mode */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ambient.privacyMode')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('ambient.privacyModeDescription')}
            </p>
          </div>
          <select
            value={pendingSettings.privacyMode}
            onChange={e => handleSettingChange('privacyMode', e.target.value)}
            className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
          >
            <option value="standard">{t('ambient.standardPrivacy')}</option>
            <option value="enhanced">{t('ambient.enhancedPrivacy')}</option>
          </select>
        </div>
      </div>

      {/* Active Status */}
      {isAmbientModeEnabled && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {t('ambient.activeStatus')}
            </span>
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">
            {settings.audioEnabled && t('ambient.audioActive')}
            {settings.audioEnabled && settings.videoEnabled && ' • '}
            {settings.videoEnabled && t('ambient.videoActive')}
          </div>
        </div>
      )}

      {showConsentDialog && <ConsentDialog />}
    </div>
  );
};
