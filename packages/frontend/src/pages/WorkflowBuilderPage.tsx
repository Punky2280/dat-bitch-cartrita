// packages/frontend/src/pages/WorkflowBuilderPage.tsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

// --- Interfaces ---
interface WorkflowStep {
  id: string;
  agent: string;
  task: string;
}

interface Workflow {
  id: number;
  name: string;
  definition: WorkflowStep[];
  updated_at: string;
}

interface WorkflowBuilderPageProps {
  token: string;
}

// --- Agent Roster ---
const agentRoster = [
  'CoreAgent', 'CodeWriterAgent', 'ResearcherAgent', 'ComedianAgent', 'ConstitutionalAI',
  'ArtistAgent', 'WriterAgent', 'MusicianAgent', 'DesignerAgent', 'DataScientistAgent',
  'FinancialAnalystAgent', 'LegalAnalystAgent', 'SchedulerAgent', 'EmailManagerAgent',
  'WebAutomatorAgent', 'ProjectManagerAgent', 'TravelAgent', 'FitnessCoachAgent',
  'ChefAgent', 'WellnessAgent', 'DatabaseAdminAgent', 'DevOpsAgent',
  'SecurityAnalystAgent', 'DocumentationWriterAgent', 'TranslatorAgent'
];

// --- Main Component ---
const WorkflowBuilderPage: React.FC<WorkflowBuilderPageProps> = ({ token }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState<number | null>(null); // Store ID of running workflow
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- API Functions ---
  const fetchWorkflows = async () => {
    // ... fetchWorkflows logic ...
    try {
      const res = await fetch('/api/workflows', { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch workflows');
      const data = await res.json();
      setWorkflows(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [token]);

  const handleSelectWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(JSON.parse(JSON.stringify(workflow)));
  };

  const handleCreateNew = () => {
    setSelectedWorkflow({
      id: 0,
      name: 'New Untitled Workflow',
      definition: [{ id: `step-${Date.now()}`, agent: 'ResearcherAgent', task: '' }],
      updated_at: new Date().toISOString(),
    });
  };

  const handleSaveWorkflow = async () => {
    // ... handleSaveWorkflow logic ...
    if (!selectedWorkflow) return;
    setMessage(null);
    setIsSaving(true);
    const isNew = selectedWorkflow.id === 0;
    const url = isNew ? '/api/workflows' : `/api/workflows/${selectedWorkflow.id}`;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: selectedWorkflow.name, definition: selectedWorkflow.definition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save workflow');
      
      setMessage({ type: 'success', text: 'Workflow saved successfully!' });
      setSelectedWorkflow(null);
      fetchWorkflows();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: number) => {
    // ... handleDeleteWorkflow logic ...
    if (!window.confirm('Are you sure you want to delete this workflow? This cannot be undone.')) return;
     try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
       if (!res.ok) throw new Error('Failed to delete workflow');
       setMessage({ type: 'success', text: 'Workflow deleted.' });
       fetchWorkflows();
     } catch (error: any) {
       setMessage({ type: 'error', text: error.message });
     }
  };

  // --- NEW: Function to run a workflow ---
  const handleRunWorkflow = async (id: number) => {
    setMessage(null);
    setIsRunning(id);
    try {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Workflow execution failed.');
      
      // Display the final result from Cartrita in a modal/alert
      // A more sophisticated UI could add this to the chat history
      alert(`Workflow Result:\n\n${data.result}`);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsRunning(null);
    }
  };


  // --- Editor State Management ---
  const updateWorkflowName = (name: string) => {
    if (selectedWorkflow) setSelectedWorkflow({ ...selectedWorkflow, name });
  };
  const updateStep = (index: number, field: 'agent' | 'task', value: string) => {
    if (selectedWorkflow) {
      const newDefinition = [...selectedWorkflow.definition];
      newDefinition[index] = { ...newDefinition[index], [field]: value };
      setSelectedWorkflow({ ...selectedWorkflow, definition: newDefinition });
    }
  };
  const addStep = () => {
    if (selectedWorkflow) {
      const newStep: WorkflowStep = { id: `step-${Date.now()}`, agent: 'ResearcherAgent', task: '' };
      setSelectedWorkflow({ ...selectedWorkflow, definition: [...selectedWorkflow.definition, newStep] });
    }
  };
  const removeStep = (index: number) => {
    if (selectedWorkflow && selectedWorkflow.definition.length > 1) {
      const newDefinition = selectedWorkflow.definition.filter((_, i) => i !== index);
      setSelectedWorkflow({ ...selectedWorkflow, definition: newDefinition });
    }
  };
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedWorkflow) return;
    const items = Array.from(selectedWorkflow.definition);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSelectedWorkflow({ ...selectedWorkflow, definition: items });
  };

  // --- Render Functions ---
  if (isLoading) {
    return <div className="text-center text-gray-400 p-8">Loading Workflows...</div>;
  }

  if (selectedWorkflow) {
    // ... Editor View remains the same ...
    return (
      <div className="p-4 sm:p-6 md:p-8 text-white h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setSelectedWorkflow(null)} className="bg-gray-700 hover:bg-gray-600 text-cyan-300 font-bold py-2 px-4 rounded-lg">
            &larr; Back to List
          </button>
          <h1 className="text-3xl font-bold text-cyan-400">Edit Workflow</h1>
          <button onClick={handleSaveWorkflow} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
        
        {message && <div className={`p-3 rounded-lg mb-4 text-center ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}

        <input
          type="text"
          value={selectedWorkflow.name}
          onChange={(e) => updateWorkflowName(e.target.value)}
          className="w-full bg-gray-900 text-white text-2xl font-bold p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-6"
        />

        <div className="flex-grow overflow-y-auto pr-2">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="steps">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {selectedWorkflow.definition.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="bg-black bg-opacity-40 border border-gray-600 p-4 rounded-lg flex items-start gap-4">
                          <div className="text-cyan-400 font-bold text-2xl mt-2">{index + 1}</div>
                          <div className="flex-grow space-y-2">
                            <select value={step.agent} onChange={(e) => updateStep(index, 'agent', e.target.value)} className="w-full bg-gray-800 p-2 rounded border border-gray-500">
                              {agentRoster.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                            </select>
                            <textarea
                              value={step.task}
                              onChange={(e) => updateStep(index, 'task', e.target.value)}
                              placeholder={`What should the ${step.agent} do?`}
                              className="w-full bg-gray-800 p-2 rounded border border-gray-500 h-24 resize-none"
                            />
                          </div>
                          <button onClick={() => removeStep(index)} className="bg-red-600 hover:bg-red-500 text-white font-bold p-2 rounded-full mt-2 h-10 w-10">
                            &times;
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <button onClick={addStep} className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg w-full">
          + Add Step
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 text-white h-full">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-cyan-400">Workflows</h1>
          <button onClick={handleCreateNew} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg">
            + Create New Workflow
          </button>
        </div>
        {message && <div className={`p-3 rounded-lg mb-4 text-center ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{message.text}</div>}
        <div className="space-y-4">
          {workflows.length > 0 ? workflows.map(wf => (
            <div key={wf.id} className="bg-black bg-opacity-30 border border-gray-700 p-4 rounded-lg flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{wf.name}</h2>
                <p className="text-sm text-gray-400">Last updated: {new Date(wf.updated_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRunWorkflow(wf.id)} disabled={isRunning === wf.id} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                  {isRunning === wf.id ? 'Running...' : 'Run'}
                </button>
                <button onClick={() => handleSelectWorkflow(wf)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Edit</button>
                 <button onClick={() => handleDeleteWorkflow(wf.id)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Delete</button>
              </div>
            </div>
          )) : (
            <p className="text-center text-gray-400 py-8">You haven't created any workflows yet. Get started!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilderPage;
