import MetaverseInterface from '@/components/metaverse/MetaverseInterface';

export default function MetaversePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Metaverse Integration
          </h1>
          <p className="mt-2 text-gray-600">
            Connect to virtual worlds, AR/VR environments, and collaborative spaces
          </p>
        </div>
        
        <MetaverseInterface />
      </div>
    </div>
  );
}