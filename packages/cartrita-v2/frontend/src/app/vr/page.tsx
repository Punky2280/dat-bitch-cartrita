import VRInterface from '@/components/3d/VRInterface';

export default function VRPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            VR/AR Interface
          </h1>
          <p className="mt-2 text-gray-600">
            Immersive 3D environment with spatial tracking and interaction
          </p>
        </div>
        
        <VRInterface />
      </div>
    </div>
  );
}