#!/usr/bin/env python3
"""
Minimal test script for quantum computing functionality
"""
import os
import sys
sys.path.append('/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2/py')

# Set non-GUI backend to avoid display issues
os.environ["MPLBACKEND"] = "Agg"

def test_quantum_imports():
    """Test basic quantum computing imports"""
    try:
        print("Testing Qiskit imports...")
        from qiskit import QuantumCircuit, transpile
        from qiskit_aer import AerSimulator
        print("✅ Qiskit imports successful")
        
        # Test creating a simple circuit
        circuit = QuantumCircuit(2, 2)
        circuit.h(0)
        circuit.cx(0, 1)
        circuit.measure_all()
        print("✅ Basic quantum circuit created")
        
        # Test simulator
        simulator = AerSimulator()
        compiled_circuit = transpile(circuit, simulator)
        print("✅ Circuit compilation successful")
        
        # Run simulation
        job = simulator.run(compiled_circuit, shots=1024)
        result = job.result()
        counts = result.get_counts(compiled_circuit)
        print(f"✅ Quantum simulation successful: {counts}")
        
        return True
        
    except Exception as e:
        print(f"❌ Quantum imports failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_quantum_engine():
    """Test our quantum engine"""
    try:
        print("Testing QuantumEngine...")
        from cartrita_core.quantum_computing import QuantumEngine, QuantumAlgorithmConfig
        print("✅ QuantumEngine imported")
        
        # Create engine
        engine = QuantumEngine()
        print("✅ QuantumEngine created")
        
        return True
        
    except Exception as e:
        print(f"❌ QuantumEngine test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_quantum_async():
    """Test quantum functionality asynchronously"""
    try:
        from cartrita_core.quantum_computing import QuantumEngine, QuantumAlgorithmConfig
        
        engine = QuantumEngine()
        
        # Test basic circuit creation
        print("Testing basic circuit creation...")
        circuit_result = await engine.create_quantum_circuit("basic_gates", 2, {"layers": 2})
        
        if circuit_result["success"]:
            print("✅ Quantum circuit creation successful")
        else:
            print(f"❌ Circuit creation failed: {circuit_result}")
            
        # Test VQE algorithm
        print("Testing VQE algorithm...")
        config = QuantumAlgorithmConfig(
            algorithm_type="vqe",
            parameters={"num_qubits": 2, "layers": 2},
            optimizer="SPSA"
        )
        
        vqe_result = await engine.run_algorithm(config)
        
        if vqe_result["success"]:
            print("✅ VQE algorithm test successful")
            print(f"   Result: {vqe_result}")
        else:
            print(f"❌ VQE failed: {vqe_result}")
            
        return True
        
    except Exception as e:
        print(f"❌ Async quantum test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import asyncio
    
    print("🧪 Running Quantum Computing Tests...")
    print("=" * 50)
    
    # Test 1: Basic imports
    print("\n1. Testing basic imports...")
    imports_ok = test_quantum_imports()
    
    # Test 2: QuantumEngine
    print("\n2. Testing QuantumEngine...")
    engine_ok = test_quantum_engine()
    
    # Test 3: Async functionality  
    if engine_ok:
        print("\n3. Testing async quantum operations...")
        async_ok = asyncio.run(test_quantum_async())
    else:
        async_ok = False
    
    print("\n" + "=" * 50)
    print("🎯 Test Results:")
    print(f"   Imports: {'✅ PASS' if imports_ok else '❌ FAIL'}")
    print(f"   Engine:  {'✅ PASS' if engine_ok else '❌ FAIL'}")
    print(f"   Async:   {'✅ PASS' if async_ok else '❌ FAIL'}")
    
    if imports_ok and engine_ok and async_ok:
        print("\n🎉 All quantum computing tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)