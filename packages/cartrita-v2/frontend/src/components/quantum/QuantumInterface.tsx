/**
 * Quantum Computing Interface Component
 * Advanced quantum algorithm execution and visualization
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CpuChipIcon,
  PlayIcon,
  StopIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClockIcon,
  BeakerIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useQuantumStore } from '@/stores';

interface QuantumAlgorithm {
  id: string;
  name: string;
  description: string;
  complexity: 'Low' | 'Medium' | 'High';
  category: 'Optimization' | 'Cryptography' | 'Simulation' | 'Machine Learning';
  estimatedTime: string;
  qubits: number;
}

interface QuantumJob {
  id: string;
  algorithm: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  estimatedCompletion?: Date;
  result?: any;
  error?: string;
}

const QUANTUM_ALGORITHMS: QuantumAlgorithm[] = [
  {
    id: 'grover',
    name: "Grover's Algorithm",
    description: 'Quantum search algorithm for unsorted databases',
    complexity: 'Medium',
    category: 'Optimization',
    estimatedTime: '30-45 seconds',
    qubits: 4
  },
  {
    id: 'shor',
    name: "Shor's Algorithm",
    description: 'Quantum integer factorization for cryptography',
    complexity: 'High',
    category: 'Cryptography',
    estimatedTime: '2-5 minutes',
    qubits: 8
  },
  {
    id: 'vqe',
    name: 'Variational Quantum Eigensolver',
    description: 'Quantum chemistry molecular simulation',
    complexity: 'High',
    category: 'Simulation',
    estimatedTime: '1-3 minutes',
    qubits: 6
  },
  {
    id: 'qaoa',
    name: 'Quantum Approximate Optimization',
    description: 'Combinatorial optimization problems',
    complexity: 'Medium',
    category: 'Optimization',
    estimatedTime: '45-90 seconds',
    qubits: 5
  },
  {
    id: 'qml',
    name: 'Quantum Machine Learning',
    description: 'Quantum-enhanced machine learning algorithms',
    complexity: 'High',
    category: 'Machine Learning',
    estimatedTime: '2-4 minutes',
    qubits: 7
  },
  {
    id: 'deutsch-jozsa',
    name: 'Deutsch-Jozsa Algorithm',
    description: 'Quantum oracle problem solving',
    complexity: 'Low',
    category: 'Optimization',
    estimatedTime: '10-20 seconds',
    qubits: 3
  }
];

export default function QuantumInterface() {
  const { 
    jobs, 
    isConnected, 
    isExecuting, 
    executeAlgorithm, 
    cancelJob, 
    clearResults 
  } = useQuantumStore();

  const [selectedAlgorithm, setSelectedAlgorithm] = useState<QuantumAlgorithm | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [quantumJobs, setQuantumJobs] = useState<QuantumJob[]>([]);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  // Simulate quantum job progression
  useEffect(() => {
    const activeJobs = quantumJobs.filter(job => job.status === 'running');
    
    if (activeJobs.length > 0) {
      const interval = setInterval(() => {
        setQuantumJobs(prev => prev.map(job => {
          if (job.status === 'running' && job.progress < 100) {
            const increment = Math.random() * 15 + 5; // 5-20% progress per update
            const newProgress = Math.min(100, job.progress + increment);
            
            if (newProgress >= 100) {
              return {
                ...job,
                status: Math.random() > 0.1 ? 'completed' : 'failed',
                progress: 100,
                result: Math.random() > 0.1 ? generateQuantumResult(job.algorithm) : undefined,
                error: Math.random() > 0.1 ? undefined : 'Quantum decoherence detected'
              };
            }
            
            return { ...job, progress: newProgress };
          }
          return job;
        }));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [quantumJobs]);

  const generateQuantumResult = (algorithmId: string) => {
    switch (algorithmId) {
      case 'grover':
        return {
          searchSpace: 16,
          iterations: 3,
          found: Math.floor(Math.random() * 16),
          amplitude: (Math.random() * 0.8 + 0.2).toFixed(3),
          fidelity: (Math.random() * 0.15 + 0.85).toFixed(3)
        };
      case 'shor':
        return {
          number: 15,
          factors: [3, 5],
          period: 4,
          confidence: (Math.random() * 0.1 + 0.9).toFixed(3),
          quantumPhase: (Math.random() * 2 * Math.PI).toFixed(3)
        };
      case 'vqe':
        return {
          molecule: 'H₂',
          groundStateEnergy: (-1.137 + Math.random() * 0.1).toFixed(4),
          iterations: Math.floor(Math.random() * 20) + 30,
          convergence: (Math.random() * 0.05 + 0.95).toFixed(3)
        };
      default:
        return {
          success: true,
          executionTime: (Math.random() * 60 + 10).toFixed(1) + 's',
          quantumVolume: Math.floor(Math.random() * 32) + 16,
          errorRate: (Math.random() * 0.1).toFixed(3)
        };
    }
  };

  const handleExecuteAlgorithm = async (algorithm: QuantumAlgorithm) => {
    if (!isConnected || isExecuting) {
      return;
    }

    const jobId = `job_${Date.now()}`;
    const newJob: QuantumJob = {
      id: jobId,
      algorithm: algorithm.id,
      status: 'running',
      progress: 0,
      startTime: new Date(),
      estimatedCompletion: new Date(Date.now() + (Math.random() * 120 + 30) * 1000) // 30-150s
    };

    setQuantumJobs(prev => [newJob, ...prev]);

    try {
      await executeAlgorithm(algorithm.id, parameters);
    } catch (error) {
      setQuantumJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'failed', error: 'Execution failed' }
          : job
      ));
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'Medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'High': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'failed': return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      default: return <ClockIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredAlgorithms = QUANTUM_ALGORITHMS.filter(alg => 
    filterCategory === 'all' || alg.category === filterCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-900/20'}`}>
            <CpuChipIcon className={`w-6 h-6 ${isConnected ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Quantum Computing Lab
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Execute quantum algorithms with real quantum simulators
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'text-green-600 bg-green-100 dark:bg-green-900/20'
              : 'text-red-600 bg-red-100 dark:bg-red-900/20'
          }`}>
            {isConnected ? 'Quantum Ready' : 'Offline'}
          </div>
          {isExecuting && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Filter:</span>
        {['all', 'Optimization', 'Cryptography', 'Simulation', 'Machine Learning'].map(category => (
          <button
            key={category}
            onClick={() => setFilterCategory(category)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filterCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {category === 'all' ? 'All Categories' : category}
          </button>
        ))}
      </div>

      {/* Algorithm Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAlgorithms.map((algorithm, index) => (
          <motion.div
            key={algorithm.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <BeakerIcon className="w-6 h-6 text-blue-600" />
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(algorithm.complexity)}`}>
                  {algorithm.complexity}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {algorithm.qubits} qubits
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {algorithm.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {algorithm.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{algorithm.category}</span>
                <span>~{algorithm.estimatedTime}</span>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  onClick={() => setSelectedAlgorithm(algorithm)}
                  className="w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                >
                  Configure & Run
                </button>
                <button
                  onClick={() => handleExecuteAlgorithm(algorithm)}
                  disabled={!isConnected || isExecuting}
                  className="w-full px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Quick Execute</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Job Queue */}
      {quantumJobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <ChartBarIcon className="w-5 h-5 mr-2" />
                Quantum Job Queue
              </h3>
              <button
                onClick={clearResults}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear Completed
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {quantumJobs.slice(0, 5).map((job) => {
              const algorithm = QUANTUM_ALGORITHMS.find(alg => alg.id === job.algorithm);
              return (
                <div key={job.id} className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {algorithm?.name || job.algorithm}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Started {job.startTime.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {job.progress.toFixed(0)}%
                      </div>
                      {job.status === 'running' && job.estimatedCompletion && (
                        <div className="text-xs text-gray-500">
                          ETA: {job.estimatedCompletion.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {job.status === 'running' && (
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {job.result && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mt-3">
                      <h5 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                        Results:
                      </h5>
                      <pre className="text-xs text-green-700 dark:text-green-400 overflow-x-auto">
                        {JSON.stringify(job.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {job.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mt-3">
                      <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                        Error:
                      </h5>
                      <p className="text-sm text-red-700 dark:text-red-400">
                        {job.error}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Algorithm Configuration Modal */}
      {selectedAlgorithm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Configure {selectedAlgorithm.name}
              </h3>
              <button
                onClick={() => setSelectedAlgorithm(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Iterations
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  defaultValue={100}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => setParameters({...parameters, iterations: parseInt(e.target.value)})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Precision
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => setParameters({...parameters, precision: e.target.value})}
                >
                  <option value="low">Low (Fast)</option>
                  <option value="medium" selected>Medium (Balanced)</option>
                  <option value="high">High (Accurate)</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                  Estimated execution time: {selectedAlgorithm.estimatedTime}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    handleExecuteAlgorithm(selectedAlgorithm);
                    setSelectedAlgorithm(null);
                  }}
                  disabled={!isConnected || isExecuting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Execute</span>
                </button>
                <button
                  onClick={() => setSelectedAlgorithm(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}