#!/usr/bin/env python3
"""
Minimal FastAPI server to test quantum computing functionality
"""
import os
import sys

# Set environment to avoid display issues
os.environ["MPLBACKEND"] = "Agg"

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uvicorn

# Add project path
sys.path.append('/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2/py')

app = FastAPI(title="Quantum Computing Test API", version="1.0.0")

class QuantumRequest(BaseModel):
    algorithm_type: str
    parameters: Dict[str, Any] = {}
    optimizer: str = "SPSA"

@app.get("/health")
async def health_check():
    """Health check"""
    return {"status": "healthy", "message": "Quantum computing test server"}

@app.get("/quantum/test-imports")
async def test_quantum_imports():
    """Test basic quantum imports"""
    try:
        from qiskit import QuantumCircuit
        from qiskit_aer import AerSimulator
        
        # Create simple circuit
        circuit = QuantumCircuit(2, 2)
        circuit.h(0)
        circuit.cx(0, 1)
        circuit.measure_all()
        
        # Test simulator
        simulator = AerSimulator()
        job = simulator.run(circuit, shots=100)
        result = job.result()
        counts = result.get_counts(circuit)
        
        return {
            "success": True,
            "message": "Quantum imports working",
            "test_result": counts
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/quantum/run-vqe")
async def run_vqe_test(request: QuantumRequest):
    """Test VQE algorithm directly"""
    try:
        from qiskit import QuantumCircuit
        from qiskit.circuit.library import RealAmplitudes
        from qiskit.quantum_info import SparsePauliOp
        from qiskit_aer.primitives import Estimator as AerEstimator
        from qiskit_algorithms.optimizers import SPSA
        from qiskit_algorithms import VQE
        import numpy as np
        
        # Create a simple H2 Hamiltonian
        H2_op = SparsePauliOp.from_list([
            ("II", -1.052373245772859),
            ("IZ", 0.39793742484318045),
            ("ZI", -0.39793742484318045),
            ("ZZ", -0.01128010425623538),
            ("XX", 0.18093119978423156)
        ])
        
        # Create ansatz
        num_qubits = request.parameters.get("num_qubits", 2)
        layers = request.parameters.get("layers", 2)
        ansatz = RealAmplitudes(num_qubits, reps=layers)
        
        # Setup VQE
        estimator = AerEstimator()
        optimizer = SPSA(maxiter=50)
        
        vqe = VQE(estimator, ansatz, optimizer)
        
        # Run VQE
        result = vqe.compute_minimum_eigenvalue(H2_op)
        
        return {
            "success": True,
            "algorithm": "VQE",
            "eigenvalue": float(result.eigenvalue.real),
            "optimal_parameters": result.optimal_parameters.tolist() if result.optimal_parameters is not None else [],
            "num_iterations": len(result.cost_function_evals) if hasattr(result, 'cost_function_evals') else 0
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.post("/quantum/run-qaoa")
async def run_qaoa_test(request: QuantumRequest):
    """Test QAOA algorithm directly"""
    try:
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import SparsePauliOp
        from qiskit_aer.primitives import Sampler as AerSampler
        from qiskit_algorithms.optimizers import COBYLA
        from qiskit_algorithms import QAOA
        import numpy as np
        
        # Create simple Max-Cut problem (triangle graph)
        # Hamiltonian for Max-Cut on triangle: -0.5*(ZZ_01 + ZZ_12 + ZZ_02)
        hamiltonian = SparsePauliOp.from_list([
            ("IZZ", -0.5),  # edge (1,2)
            ("ZIZ", -0.5),  # edge (0,2)
            ("ZZI", -0.5),  # edge (0,1)
        ])
        
        # Setup QAOA
        sampler = AerSampler()
        optimizer = COBYLA()
        reps = request.parameters.get("reps", 1)
        
        qaoa = QAOA(sampler, optimizer, reps=reps)
        
        # Run QAOA
        result = qaoa.compute_minimum_eigenvalue(hamiltonian)
        
        return {
            "success": True,
            "algorithm": "QAOA",
            "eigenvalue": float(result.eigenvalue.real),
            "optimal_parameters": result.optimal_parameters.tolist() if result.optimal_parameters is not None else [],
            "num_iterations": len(result.cost_function_evals) if hasattr(result, 'cost_function_evals') else 0,
            "max_cut_value": -float(result.eigenvalue.real)  # Convert back to Max-Cut value
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    print("🚀 Starting Quantum Computing Test Server...")
    uvicorn.run("test_quantum_server:app", host="127.0.0.1", port=8005, reload=False)