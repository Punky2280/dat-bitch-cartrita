/**
 * Quantum Page - Cartrita V2
 * Quantum computing interface and algorithms
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CpuChipIcon,
  PlusIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import { useQuantumStore } from '@/stores';

interface QuantumJob {
  id: string;
  name: string;
  algorithm: string;
  parameters: Record<string, any>;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  qubits: number;
  shots: number;
  results?: any;
}

interface QuantumAlgorithm {
  id: string;
  name: string;
  description: string;
  category: 'optimization' | 'simulation' | 'machine_learning' | 'cryptography' | 'research';
  complexity: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  parameters: AlgorithmParameter[];
  qubit_range: [number, number];
}

interface AlgorithmParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
  min?: number;
  max?: number;
  options?: string[];
}

const QUANTUM_ALGORITHMS: QuantumAlgorithm[] = [
  {
    id: 'qaoa',
    name: 'Quantum Approximate Optimization Algorithm (QAOA)',
    description: 'Hybrid quantum-classical algorithm for combinatorial optimization problems',
    category: 'optimization',
    complexity: 'intermediate',
    qubit_range: [4, 20],
    parameters: [
      { name: 'layers', type: 'number', description: 'Number of QAOA layers', required: true, default: 1, min: 1, max: 10 },
      { name: 'shots', type: 'number', description: 'Number of measurement shots', required: true, default: 1024, min: 100, max: 10000 },
      { name: 'optimizer', type: 'string', description: 'Classical optimizer', required: true, default: 'COBYLA', options: ['COBYLA', 'SPSA', 'NELDER_MEAD'] }
    ]
  },
  {
    id: 'vqe',
    name: 'Variational Quantum Eigensolver (VQE)',
    description: 'Find ground state energies of quantum systems',
    category: 'simulation',
    complexity: 'advanced',
    qubit_range: [2, 16],
    parameters: [
      { name: 'molecule', type: 'string', description: 'Molecular formula', required: true, default: 'H2' },
      { name: 'basis', type: 'string', description: 'Basis set', required: true, default: 'sto-3g', options: ['sto-3g', '6-31g', 'cc-pvdz'] },
      { name: 'ansatz', type: 'string', description: 'Variational ansatz', required: true, default: 'UCCSD', options: ['UCCSD', 'HardwareEfficient', 'RealAmplitudes'] }
    ]
  },
  {
    id: 'qml_classifier',
    name: 'Quantum Machine Learning Classifier',
    description: 'Quantum neural network for classification tasks',
    category: 'machine_learning',
    complexity: 'advanced',
    qubit_range: [4, 12],
    parameters: [
      { name: 'features', type: 'number', description: 'Number of input features', required: true, default: 4, min: 2, max: 16 },
      { name: 'layers', type: 'number', description: 'Number of variational layers', required: true, default: 2, min: 1, max: 6 },
      { name: 'learning_rate', type: 'number', description: 'Learning rate', required: true, default: 0.01, min: 0.001, max: 1.0 }
    ]
  },
  {
    id: 'grover',
    name: "Grover's Search Algorithm",
    description: 'Quantum search algorithm for unstructured databases',
    category: 'research',
    complexity: 'intermediate',
    qubit_range: [3, 20],
    parameters: [
      { name: 'search_space_size', type: 'number', description: 'Size of search space (2^n)', required: true, default: 8, min: 4, max: 1048576 },
      { name: 'target_items', type: 'number', description: 'Number of target items', required: true, default: 1, min: 1, max: 100 }
    ]
  },
  {
    id: 'shor',
    name: "Shor's Factoring Algorithm",
    description: 'Quantum algorithm for integer factorization',
    category: 'cryptography',
    complexity: 'expert',
    qubit_range: [8, 50],
    parameters: [
      { name: 'number_to_factor', type: 'number', description: 'Integer to factorize', required: true, default: 15, min: 15, max: 999999 },
      { name: 'use_simulator', type: 'boolean', description: 'Use quantum simulator', required: true, default: true }
    ]
  }
];

export default function QuantumPage() {
  const {
    jobs,
    selectedJob,
    isLoading,
    error,
    loadJobs,
    createJob,
    cancelJob,
    getJobResults,
    selectJob
  } = useQuantumStore();

  const [selectedAlgorithm, setSelectedAlgorithm] = useState<QuantumAlgorithm | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'algorithms' | 'jobs' | 'results'>('algorithms');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const filteredAlgorithms = QUANTUM_ALGORITHMS.filter(algorithm => {
    const matchesCategory = categoryFilter === 'all' || algorithm.category === categoryFilter;
    const matchesComplexity = complexityFilter === 'all' || algorithm.complexity === complexityFilter;
    return matchesCategory && matchesComplexity;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'optimization':
        return <ChartBarIcon className="w-5 h-5" />;
      case 'simulation':
        return <BeakerIcon className="w-5 h-5" />;
      case 'machine_learning':
        return <CpuChipIcon className="w-5 h-5" />;
      case 'cryptography':
        return <WrenchScrewdriverIcon className="w-5 h-5" />;
      case 'research':
        return <AcademicCapIcon className="w-5 h-5" />;
      default:
        return <Cog6ToothIcon className="w-5 h-5" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner':
        return 'text-green-600 dark:text-green-400';
      case 'intermediate':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'advanced':
        return 'text-orange-600 dark:text-orange-400';
      case 'expert':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const jobStats = {
    total: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                <CpuChipIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Quantum Computing Lab
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Explore quantum algorithms and run quantum computations
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowJobModal(true)}
                className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                New Quantum Job
              </button>
            </div>
          </div>

          {/* Job Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {jobStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Jobs</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {jobStats.queued}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Queued</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {jobStats.running}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Running</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {jobStats.completed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {jobStats.failed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'algorithms', name: 'Algorithms', icon: BeakerIcon },
              { id: 'jobs', name: 'Jobs', icon: ClockIcon },
              { id: 'results', name: 'Results', icon: ChartBarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Algorithms Tab */}
          {activeTab === 'algorithms' && (
            <motion.div
              key="algorithms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="optimization">Optimization</option>
                    <option value="simulation">Simulation</option>
                    <option value="machine_learning">Machine Learning</option>
                    <option value="cryptography">Cryptography</option>
                    <option value="research">Research</option>
                  </select>
                  
                  <select
                    value={complexityFilter}
                    onChange={(e) => setComplexityFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Complexity</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>

              {/* Algorithm Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAlgorithms.map((algorithm, index) => (
                  <motion.div
                    key={algorithm.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          {getCategoryIcon(algorithm.category)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {algorithm.name}
                          </h3>
                          <p className={`text-sm font-medium capitalize ${getComplexityColor(algorithm.complexity)}`}>
                            {algorithm.complexity}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {algorithm.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span>Qubits: {algorithm.qubit_range[0]}-{algorithm.qubit_range[1]}</span>
                      <span className="capitalize">{algorithm.category}</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedAlgorithm(algorithm);
                        setShowJobModal(true);
                      }}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Run Algorithm
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
            <motion.div
              key="jobs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Quantum Jobs
                </h2>
                
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {job.name}
                          </h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {job.algorithm} • {job.qubits} qubits • {job.shots} shots
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Created {new Date(job.created_at).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {job.status === 'completed' && (
                          <button
                            onClick={() => {
                              selectJob(job.id);
                              setShowResultsModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="View Results"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                        
                        {(job.status === 'queued' || job.status === 'running') && (
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Cancel Job"
                          >
                            <StopIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {jobs.length === 0 && (
                    <div className="text-center py-12">
                      <CpuChipIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No quantum jobs yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Run your first quantum algorithm to get started.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Quantum Results Archive
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {jobs.filter(j => j.status === 'completed').map((job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {job.name}
                      </h3>
                      <button
                        onClick={() => {
                          selectJob(job.id);
                          setShowResultsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        View Details
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {job.algorithm}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      Completed {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      <AnimatePresence>
        {showJobModal && (
          <CreateJobModal 
            algorithm={selectedAlgorithm}
            onClose={() => {
              setShowJobModal(false);
              setSelectedAlgorithm(null);
            }}
            onSubmit={(jobData) => {
              createJob(jobData);
              setShowJobModal(false);
              setSelectedAlgorithm(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Results Modal */}
      <AnimatePresence>
        {showResultsModal && selectedJob && (
          <ResultsModal 
            job={selectedJob}
            onClose={() => setShowResultsModal(false)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// Create Job Modal Component
interface CreateJobModalProps {
  algorithm: QuantumAlgorithm | null;
  onClose: () => void;
  onSubmit: (jobData: any) => void;
}

function CreateJobModal({ algorithm, onClose, onSubmit }: CreateJobModalProps) {
  const [jobName, setJobName] = useState('');
  const [selectedAlg, setSelectedAlg] = useState(algorithm?.id || '');
  const [qubits, setQubits] = useState(algorithm?.qubit_range[0] || 4);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  const currentAlgorithm = algorithm || QUANTUM_ALGORITHMS.find(a => a.id === selectedAlg);

  useEffect(() => {
    if (currentAlgorithm) {
      const defaultParams: Record<string, any> = {};
      currentAlgorithm.parameters.forEach(param => {
        if (param.default !== undefined) {
          defaultParams[param.name] = param.default;
        }
      });
      setParameters(defaultParams);
    }
  }, [currentAlgorithm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: jobName,
      algorithm: selectedAlg,
      qubits,
      parameters,
      shots: parameters.shots || 1024
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Quantum Job
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Job Name
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter job name"
                required
              />
            </div>

            {!algorithm && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Algorithm
                </label>
                <select
                  value={selectedAlg}
                  onChange={(e) => setSelectedAlg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select Algorithm</option>
                  {QUANTUM_ALGORITHMS.map(alg => (
                    <option key={alg.id} value={alg.id}>{alg.name}</option>
                  ))}
                </select>
              </div>
            )}

            {currentAlgorithm && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Qubits ({currentAlgorithm.qubit_range[0]}-{currentAlgorithm.qubit_range[1]})
                  </label>
                  <input
                    type="number"
                    value={qubits}
                    onChange={(e) => setQubits(parseInt(e.target.value))}
                    min={currentAlgorithm.qubit_range[0]}
                    max={currentAlgorithm.qubit_range[1]}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                {currentAlgorithm.parameters.map(param => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {param.name} {param.required && '*'}
                    </label>
                    <div className="text-xs text-gray-500 mb-2">{param.description}</div>
                    
                    {param.type === 'number' && (
                      <input
                        type="number"
                        value={parameters[param.name] || ''}
                        onChange={(e) => setParameters({
                          ...parameters,
                          [param.name]: parseFloat(e.target.value)
                        })}
                        min={param.min}
                        max={param.max}
                        step={param.name.includes('rate') ? 0.001 : 1}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required={param.required}
                      />
                    )}
                    
                    {param.type === 'string' && param.options && (
                      <select
                        value={parameters[param.name] || ''}
                        onChange={(e) => setParameters({
                          ...parameters,
                          [param.name]: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required={param.required}
                      >
                        {param.options.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    )}
                    
                    {param.type === 'string' && !param.options && (
                      <input
                        type="text"
                        value={parameters[param.name] || ''}
                        onChange={(e) => setParameters({
                          ...parameters,
                          [param.name]: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required={param.required}
                      />
                    )}
                    
                    {param.type === 'boolean' && (
                      <input
                        type="checkbox"
                        checked={parameters[param.name] || false}
                        onChange={(e) => setParameters({
                          ...parameters,
                          [param.name]: e.target.checked
                        })}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          
          <div className="flex items-center justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Submit Job
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Results Modal Component
interface ResultsModalProps {
  job: QuantumJob;
  onClose: () => void;
}

function ResultsModal({ job, onClose }: ResultsModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {job.name} - Results
          </h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Job Details
              </h3>
              <div className="space-y-1 text-sm">
                <div>Algorithm: {job.algorithm}</div>
                <div>Qubits: {job.qubits}</div>
                <div>Shots: {job.shots}</div>
                <div>Status: <span className="font-medium">{job.status}</span></div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timing
              </h3>
              <div className="space-y-1 text-sm">
                <div>Created: {new Date(job.created_at).toLocaleString()}</div>
                {job.started_at && (
                  <div>Started: {new Date(job.started_at).toLocaleString()}</div>
                )}
                {job.completed_at && (
                  <div>Completed: {new Date(job.completed_at).toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Results
            </h3>
            <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {job.results ? JSON.stringify(job.results, null, 2) : 'No results available'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}